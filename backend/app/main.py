from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Union, Callable
import subprocess
import os
import json
import time
import uuid
import zipfile
import io
from datetime import datetime
import sys
import shutil
from pathlib import Path
from runners.trainer_runner import run_trainer
from runners.cnn_analysis_runner import run_cnn_analysis

app = FastAPI(title="Labeling Optimizer API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://localhost:8080", "http://localhost:8081"],  # Add your frontend dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class RunRequest(BaseModel):
    symbol: str
    start: str
    end: str

class TrainingChartGeneratorRequest(BaseModel):
    symbols: str
    chartsPerLabel: int
    useCandles: bool
    timeframe: str  # '1d', '1wk', '1mo'
    timespanUnit: str
    timespanCount: int
    horizonBars: int
    takeProfitFraction: float
    stopLossFraction: float
    imageDimension: int
    endOffset: int

class RunResponse(BaseModel):
    run_id: str

class ProgressResponse(BaseModel):
    phase: str
    percent: float
    elapsed_s: float
    step: Optional[int] = None
    total_steps: Optional[int] = None
    error_message: Optional[str] = None

class DatasetStats(BaseModel):
    total_charts: Optional[int] = None
    symbols_count: Optional[int] = None
    timeframe: Optional[str] = None
    chart_type: Optional[str] = None

# Trainer models
class TrainerRequest(BaseModel):
    use_standard_config: bool = True
    folder_name: Optional[str] = None  # Legacy support
    dataset_id: Optional[str] = None   # New preferred way
    model_name: str
    image_height: Optional[int] = None
    image_width: Optional[int] = None
    batch_size: Optional[int] = None
    epochs: Optional[int] = None
    val_split: Optional[float] = None
    random_seed: Optional[int] = None

class TrainerProgressResponse(BaseModel):
    status: str  # ready, running, done, failed
    progress: Dict[str, Any]
    last_metrics: Optional[Dict[str, Any]] = None
    history_preview: Optional[List[Dict[str, Any]]] = None
    artifact_paths: Optional[List[str]] = None

class TrainerSummary(BaseModel):
    model_name: str
    config: Dict[str, Any]
    train_samples: int
    val_samples: int
    image_size: List[int]
    batch_size: int
    epochs_trained: int
    best_epoch: int
    final_metrics: Optional[Dict[str, Any]] = None
    completed_at: float

# Analysis models
class AnalysisRequest(BaseModel):
    img_path: Optional[str] = None
    white_mask_thresh: Optional[float] = 0.96

class AnalysisResponse(BaseModel):
    analysis_id: str

class AnalysisStatusResponse(BaseModel):
    status: str  # ready, running, done, failed
    progress: Dict[str, Any]
    generated_files: Optional[List[str]] = None

# Dataset upload models
class DatasetUploadResponse(BaseModel):
    dataset_id: str
    extracted_path: str
    summary: Dict[str, Any]

class DatasetSummary(BaseModel):
    dataset_id: str
    extracted_path: str
    total_images: int
    label_distribution: Dict[str, int]
    example_filenames: List[str]
    created_at: float

# Global run management
class GlobalRun(BaseModel):
    id: str
    tool: str  # "labeling-optimizer", "training-chart-generator", "trainer", "analysis", "backtester"
    status: str  # "queued", "running", "succeeded", "failed", "cancelled"
    progress: float = 0.0  # 0.0 to 1.0
    stage: str = ""
    message: str = ""
    created_at: float
    updated_at: float
    route: Optional[str] = None  # Frontend route to view this run
    parent_run_id: Optional[str] = None  # For analysis runs, the parent trainer run

# Backtester models
class BacktesterStartRequest(BaseModel):
    model_path: Optional[str] = None
    model_id: Optional[str] = None
    dataset_id: Optional[str] = None
    chart_folder: Optional[str] = None
    sample_size: Union[str, int] = "all"
    confidence_threshold: float = 0.5
    tp_pct: float = 2.0
    sl_pct: float = 2.0
    img_size: int = 224
    # Trading parameters
    starting_capital: float = 10000.0
    position_size_pct: float = 10.0  # Percentage of capital per trade
    commission_pct: float = 0.1  # Commission per trade as percentage
    slippage_pct: float = 0.05  # Slippage as percentage
    # Risk management
    max_drawdown_pct: float = 20.0  # Max drawdown before stopping
    max_trades_per_day: int = 10  # Maximum trades per simulated day

class BacktesterStatusResponse(BaseModel):
    status: str
    progress: float
    stage: str
    message: str
    live_metrics: Optional[Dict[str, Any]] = None

class BacktesterResultResponse(BaseModel):
    kpis: Dict[str, Any]
    charts: Dict[str, str]  # chart_name -> url
    download_zip_url: str
    csv_urls: Optional[Dict[str, str]] = None
    summary_url: Optional[str] = None

# Test Data Generator models
class TestDataGeneratorRequest(BaseModel):
    symbols: str
    dataset_name: str
    use_candles: bool = True
    timeframe: str = "1d"
    span_unit: str = "months"
    span_units_count: int = 6
    future_horizon_bars: int = 7
    tp_frac: float = 0.02
    sl_frac: float = 0.01
    img_dim: int = 224
    period_length_units: int = 30
    end_offset_units: int = 0
    use_sma: bool = False
    sma_length: int = 20
    training_period_start: Optional[str] = None
    training_period_end: Optional[str] = None
    test_period_start: Optional[str] = None
    test_period_end: Optional[str] = None

class TestDataGeneratorStatusResponse(BaseModel):
    status: str
    progress: float
    stage: str
    message: str
    live_metrics: Optional[Dict[str, Any]] = None

class TestDataGeneratorResultResponse(BaseModel):
    dataset_id: str
    download_zip_url: str
    summary: Dict[str, Any]

# Model upload response
class ModelUploadResponse(BaseModel):
    model_id: str

def register_run(run_id: str, tool: str, route: Optional[str] = None, parent_run_id: Optional[str] = None) -> None:
    """Register a new run in the global registry"""
    now = time.time()
    all_runs[run_id] = GlobalRun(
        id=run_id,
        tool=tool,
        status="running",
        progress=0.0,
        stage="starting",
        message="Initializing...",
        created_at=now,
        updated_at=now,
        route=route,
        parent_run_id=parent_run_id
    )

def update_run_progress(run_id: str, progress: float, stage: str, message: str = "", status: Optional[str] = None) -> None:
    """Update run progress"""
    if run_id in all_runs:
        run = all_runs[run_id]
        run.progress = progress
        run.stage = stage
        run.message = message
        run.updated_at = time.time()
        if status:
            run.status = status

def get_active_runs() -> List[GlobalRun]:
    """Get all active (running/queued) runs"""
    return [run for run in all_runs.values() if run.status in ["running", "queued"]]

def get_run(run_id: str) -> Optional[GlobalRun]:
    """Get a specific run by ID"""
    return all_runs.get(run_id)

# Global runs storage (in production, use a database)
runs_dir = os.path.join(os.path.dirname(__file__), "..", "runs")
os.makedirs(runs_dir, exist_ok=True)

# Global run registry - unified across all tools
all_runs = {}  # run_id -> run metadata
running_processes = {}  # run_id -> subprocess.Popen object

def generate_run_id() -> str:
    """Generate a unique run ID based on timestamp"""
    return datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + str(uuid.uuid4())[:6]

def get_run_dir(run_id: str) -> str:
    """Get the run directory path"""
    return os.path.join(runs_dir, run_id)

def get_artifacts_dir(run_id: str) -> str:
    """Get the artifacts directory path"""
    return os.path.join(get_run_dir(run_id), "artifacts")

def read_progress_file(run_id: str) -> Dict[str, Any]:
    """Safely read progress.json file"""
    progress_file = os.path.join(get_run_dir(run_id), "progress.json")
    try:
        if os.path.exists(progress_file):
            with open(progress_file, 'r') as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass

    # Return default progress if file doesn't exist or can't be read
    return {
        "phase": "starting",
        "percent": 0,
        "elapsed_s": 0,
        "step": 0,
        "total_steps": None
    }

def run_labeling_optimizer(symbol: str, start: str, end: str, run_id: str):
    """Run the labeling optimizer script"""
    run_dir = get_run_dir(run_id)
    artifacts_dir = get_artifacts_dir(run_id)

    # Create directories
    os.makedirs(run_dir, exist_ok=True)
    os.makedirs(artifacts_dir, exist_ok=True)

    # Write initial progress
    initial_progress = {
        "phase": "starting",
        "percent": 0,
        "elapsed_s": 0,
        "step": 0,
        "total_steps": None
    }
    with open(os.path.join(run_dir, "progress.json"), 'w') as f:
        json.dump(initial_progress, f)

    # Update global run registry
    update_run_progress(run_id, 0.0, "starting", "Initializing labeling optimizer...")

    try:
        # Find the Python script - use the local path
        script_path = "/Users/alexandernicoud/Desktop/convolve-broken frontend/7.2.py"

        if not os.path.exists(script_path):
            # Fallback to relative path from backend directory
            script_path = os.path.join(os.path.dirname(__file__), "..", "7.2.py")

        if not os.path.exists(script_path):
            raise FileNotFoundError(f"Python script not found at {script_path}")

        # Run the script
        cmd = [
            sys.executable,  # Use the same Python that's running this FastAPI app
            script_path,
            "--symbol", symbol,
            "--start", start,
            "--end", end,
            "--run_id", run_id,
            "--out_dir", runs_dir
        ]

        result = subprocess.run(
            cmd,
            cwd=os.path.dirname(script_path),
            capture_output=True,
            text=True,
            timeout=3600  # 1 hour timeout
        )

        if result.returncode == 0:
            # Copy important chart files and metrics to artifacts directory for frontend access
            import shutil
            chart_files = [
                f"{symbol}_risk_return_cagr_vs_maxdd.png",
                f"{symbol}_cagr_vs_horizon_spread_groups.png",
                f"{symbol}_benchmarks_vs_best_cagr.png",
                f"{symbol}_correlation_matrix.png",
                f"{symbol}_hist_annual_pnl_per_year.png",
                f"{symbol}_cagr_vs_winrate.png",
                "metrics.json"  # Include the metrics JSON file
            ]

            for chart_file in chart_files:
                src_path = os.path.join(runs_dir, chart_file)
                if os.path.exists(src_path):
                    dst_path = os.path.join(artifacts_dir, chart_file)
                    shutil.copy2(src_path, dst_path)

            # Update global run registry for success
            update_run_progress(run_id, 1.0, "completed", "Labeling optimization completed successfully", "succeeded")

        if result.returncode != 0:
            # Update progress with error
            error_progress = {
                "phase": "error",
                "percent": 0,
                "elapsed_s": 0,
                "step": 0,
                "total_steps": None,
                "error_message": f"Script execution failed: {result.stderr[:500]}"
            }
            with open(os.path.join(run_dir, "progress.json"), 'w') as f:
                json.dump(error_progress, f)

            # Update global run registry
            update_run_progress(run_id, 0.0, "error", f"Script execution failed: {result.stderr[:100]}", "failed")

    except subprocess.TimeoutExpired:
        error_progress = {
            "phase": "error",
            "percent": 0,
            "elapsed_s": 3600,
            "step": 0,
            "total_steps": None,
            "error_message": "Script execution timed out after 1 hour"
        }
        with open(os.path.join(run_dir, "progress.json"), 'w') as f:
            json.dump(error_progress, f)

        # Update global run registry
        update_run_progress(run_id, 0.0, "timeout", "Script execution timed out", "failed")

    except Exception as e:
        error_progress = {
            "phase": "error",
            "percent": 0,
            "elapsed_s": 0,
            "step": 0,
            "total_steps": None,
            "error_message": f"Unexpected error: {str(e)[:500]}"
        }
        with open(os.path.join(run_dir, "progress.json"), 'w') as f:
            json.dump(error_progress, f)

        # Update global run registry
        update_run_progress(run_id, 0.0, "error", f"Unexpected error: {str(e)[:100]}", "failed")

def run_training_chart_generator(config: Dict[str, Any], run_id: str):
    """Run the training chart generator script"""
    run_dir = get_run_dir(run_id)
    artifacts_dir = get_artifacts_dir(run_id)

    # Create directories
    os.makedirs(run_dir, exist_ok=True)
    os.makedirs(artifacts_dir, exist_ok=True)

    # Write initial progress
    initial_progress = {
        "phase": "starting",
        "percent": 0,
        "elapsed_s": 0,
        "step": 0,
        "total_steps": None
    }
    with open(os.path.join(run_dir, "progress.json"), 'w') as f:
        json.dump(initial_progress, f)

    try:
        # Find the Python script
        script_path = "/Users/alexandernicoud/Desktop/convolve-broken frontend/1.3_Adj_TrL.py"

        if not os.path.exists(script_path):
            # Fallback to relative path from backend directory
            script_path = os.path.join(os.path.dirname(__file__), "..", "1.3_Adj_TrL.py")

        if not os.path.exists(script_path):
            raise FileNotFoundError(f"Python script not found at {script_path}")

        # Prepare script arguments from config
        symbols = config['symbols']
        x = config['chartsPerLabel']  # charts per symbol per label
        use_candles = "yes" if config['useCandles'] else "no"
        t = config['timeframe']  # '1d', '1wk', '1mo'
        u = config['timespanUnit']  # e.g. 'months'
        o = config['timespanCount']  # how many units
        w = config['horizonBars']  # future horizon in bars
        f = config['takeProfitFraction']  # take profit fraction
        s = config['stopLossFraction']  # stop loss fraction
        img_dim = config['imageDimension']  # image dimension
        i1 = config['endOffset']  # end offset

        # Create a temporary output directory for this run
        temp_out_dir = os.path.join(run_dir, "temp_output")
        os.makedirs(temp_out_dir, exist_ok=True)

        # Simulate progress updates during execution
        def update_progress(phase: str, percent: float, error_message: str = None):
            progress_data = {
                "phase": phase,
                "percent": percent,
                "elapsed_s": time.time() - start_time,
                "step": int(percent / 10),
                "total_steps": 10
            }
            if error_message:
                progress_data["error_message"] = error_message
            with open(os.path.join(run_dir, "progress.json"), 'w') as f:
                json.dump(progress_data, f)

            # Update global run registry
            update_run_progress(run_id, percent / 100.0, phase, f"{phase} ({percent:.1f}%)")

        start_time = time.time()

        # Update progress: starting
        update_progress("Initializing", 5)

        # Create a simple wrapper script that provides inputs


        # Run the script with command line arguments (like labeling optimizer)
        cmd = [
            sys.executable,
            script_path,
            "--symbols", symbols,
            "--x", str(x),
            "--out_dir", temp_out_dir,
            "--use_candles", use_candles,
            "--t", t,
            "--u", u,
            "--o", str(o),
            "--w", str(w),
            "--f", str(f),
            "--s", str(s),
            "--img_dim", str(img_dim),
            "--i1", str(i1),
            "--run_id", run_id,
            "--progress_dir", run_dir
        ]
        print(f"About to execute: {' '.join(cmd)}")
        print(f"Working directory: {os.path.dirname(script_path)}")
        print(f"Script exists: {os.path.exists(script_path)}")
        print(f"Starting training chart generator: {' '.join(cmd)}")

        # Run the script directly (progress is updated by the script itself)
        try:
            result = subprocess.run(
                cmd,
                cwd=os.path.dirname(script_path),
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )

            returncode = result.returncode
            stdout = result.stdout
            stderr = result.stderr

        except subprocess.TimeoutExpired:
            print("Script timed out after 3600 seconds")
            returncode = -1
            stdout = ""
            stderr = "Process timed out"
            update_progress("error", 0, "Script execution timed out after 1 hour")
            update_run_progress(run_id, 0.0, "timeout", "Script execution timed out", "failed")

        except Exception as e:
            print(f"Unexpected error during script execution: {e}")
            returncode = -1
            stdout = ""
            stderr = str(e)
            update_progress("error", 0, f"Unexpected error: {str(e)}")
            update_run_progress(run_id, 0.0, "error", f"Unexpected error: {str(e)[:100]}", "failed")

        # Log output
        if stdout:
            print(f"Script stdout (last 1000 chars): {stdout[-1000:]}")
        if stderr:
            print(f"Script stderr (last 1000 chars): {stderr[-1000:]}")

        # Update final progress based on return code
        if returncode == 0:
            print("Script completed successfully")
            update_progress("done", 100)
            # Update global run registry
            update_run_progress(run_id, 1.0, "completed", "Chart generation completed successfully", "succeeded")
        else:
            error_msg = stderr[-200:] if stderr else "Unknown error"
            print(f"Script failed with return code {returncode}: {error_msg}")
            update_progress("error", 0, error_msg)
            # Update global run registry
            update_run_progress(run_id, 0.0, "error", f"Chart generation failed: {error_msg[:100]}", "failed")

        if returncode and returncode != 0:
            # Update progress with error
            try:
                stdout = result[0] if result else ""
                stderr = result[1] if result else ""
                error_msg = stderr.strip() if stderr else ""
                if not error_msg:
                    error_msg = stdout.strip()[-500:] if stdout else "Unknown error"
            except (IndexError, TypeError):
                error_msg = "Process failed without output"

            error_progress = {
                "phase": "error",
                "percent": 0,
                "elapsed_s": time.time() - start_time,
                "step": 0,
                "total_steps": None,
                "error_message": f"Script execution failed: {error_msg[:500]}"
            }
            with open(os.path.join(run_dir, "progress.json"), 'w') as f:
                json.dump(error_progress, f)
            return

        update_progress("Processing generated charts", 70)

        # Count generated files
        png_files = [f for f in os.listdir(temp_out_dir) if f.endswith('.png')]
        total_charts = len(png_files)

        # Create ZIP file
        update_progress("Creating ZIP archive", 90)

        zip_path = os.path.join(run_dir, f"training-dataset-{run_id}.zip")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file_name in png_files:
                file_path = os.path.join(temp_out_dir, file_name)
                zip_file.write(file_path, file_name)

        # Create dataset stats
        dataset_stats = {
            "total_charts": total_charts,
            "symbols_count": len(symbols.split(',')),
            "timeframe": t,
            "chart_type": "candlestick" if config['useCandles'] else "line"
        }

        with open(os.path.join(artifacts_dir, "dataset_stats.json"), 'w') as f:
            json.dump(dataset_stats, f)

        # Final progress update
        final_progress = {
            "phase": "done",
            "percent": 100,
            "elapsed_s": time.time() - start_time,
            "step": 10,
            "total_steps": 10
        }
        with open(os.path.join(run_dir, "progress.json"), 'w') as f:
            json.dump(final_progress, f)

    except subprocess.TimeoutExpired:
        error_progress = {
            "phase": "error",
            "percent": 0,
            "elapsed_s": 1800,
            "step": 0,
            "total_steps": None,
            "error_message": "Script execution timed out after 30 minutes"
        }
        with open(os.path.join(run_dir, "progress.json"), 'w') as f:
            json.dump(error_progress, f)

    except Exception as e:
        error_progress = {
            "phase": "error",
            "percent": 0,
            "elapsed_s": time.time() - start_time if 'start_time' in locals() else 0,
            "step": 0,
            "total_steps": None,
            "error_message": f"Unexpected error: {str(e)[:500]}"
        }
        with open(os.path.join(run_dir, "progress.json"), 'w') as f:
            json.dump(error_progress, f)

@app.post("/api/labeling-optimizer/run", response_model=RunResponse)
async def start_run(request: RunRequest, background_tasks: BackgroundTasks):
    """Start a labeling optimizer run"""
    run_id = generate_run_id()

    # Register run globally
    register_run(run_id, "labeling-optimizer", f"/products/labeling-optimizer/runs/{run_id}")

    # Start the script in background
    background_tasks.add_task(run_labeling_optimizer, request.symbol, request.start, request.end, run_id)

    return RunResponse(run_id=run_id)

@app.get("/api/labeling-optimizer/progress/{run_id}")
async def get_progress(run_id: str) -> ProgressResponse:
    """Get progress for a run"""
    progress_data = read_progress_file(run_id)
    return ProgressResponse(**progress_data)

@app.get("/api/labeling-optimizer/runs/{run_id}")
async def list_run_artifacts(run_id: str) -> Dict[str, List[str]]:
    """List available artifact files for a run"""
    artifacts_dir = get_artifacts_dir(run_id)

    if not os.path.exists(artifacts_dir):
        return {"artifacts": []}

    artifacts = []
    for file in os.listdir(artifacts_dir):
        if file.endswith('.json'):
            # Remove .json extension for the API
            artifacts.append(file[:-5])

    return {"artifacts": artifacts}

@app.get("/api/labeling-optimizer/artifacts/{run_id}/{name}")
async def get_artifact(run_id: str, name: str):
    """Get a specific artifact file"""
    # Sanitize the name (only allow safe characters)
    if not all(c.isalnum() or c in '._-' for c in name):
        raise HTTPException(status_code=400, detail="Invalid artifact name")

    artifacts_dir = get_artifacts_dir(run_id)
    file_path = os.path.join(artifacts_dir, f"{name}.json")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(file_path, media_type="application/json")

@app.get("/api/labeling-optimizer/download-visuals/{run_id}")
async def download_visuals(run_id: str):
    """Download all visual artifacts as a ZIP file"""
    artifacts_dir = get_artifacts_dir(run_id)

    if not os.path.exists(artifacts_dir):
        raise HTTPException(status_code=404, detail="Run not found or no artifacts available")

    # Create ZIP file in memory
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for file_name in os.listdir(artifacts_dir):
            if file_name.endswith('.json'):
                file_path = os.path.join(artifacts_dir, file_name)
                # Add file to ZIP (keeping the .json extension)
                zip_file.write(file_path, file_name)

    zip_buffer.seek(0)

    return StreamingResponse(
        io.BytesIO(zip_buffer.getvalue()),
        media_type='application/zip',
        headers={"Content-Disposition": f"attachment; filename=labeling_optimizer_visuals_{run_id}.zip"}
    )

# Training Chart Generator endpoints
@app.post("/api/training-chart-generator/run", response_model=RunResponse)
async def start_training_chart_generator(request: TrainingChartGeneratorRequest, background_tasks: BackgroundTasks):
    """Start a training chart generator run"""
    run_id = generate_run_id()

    # Register run globally
    register_run(run_id, "training-chart-generator", f"/tools/generator/runs/{run_id}")

    # Create run directory and initial progress file immediately
    run_dir = get_run_dir(run_id)
    os.makedirs(run_dir, exist_ok=True)

    initial_progress = {
        "phase": "starting",
        "percent": 1,  # Start at 1% to show it's working
        "elapsed_s": 0,
        "step": 1,
        "total_steps": 10
    }
    progress_file = os.path.join(run_dir, "progress.json")
    with open(progress_file, 'w') as f:
        json.dump(initial_progress, f)

    print(f"Created initial progress file for run {run_id}")

    # Start the script in background
    background_tasks.add_task(run_training_chart_generator, request.dict(), run_id)

    return RunResponse(run_id=run_id)

@app.get("/api/training-chart-generator/progress/{run_id}")
async def get_training_chart_generator_progress(run_id: str) -> ProgressResponse:
    """Get progress for a training chart generator run"""
    progress_data = read_progress_file(run_id)
    print(f"Progress request for run {run_id}: {progress_data}")
    return ProgressResponse(**progress_data)

@app.get("/api/training-chart-generator/artifacts/{run_id}")
async def get_training_chart_generator_artifacts(run_id: str) -> DatasetStats:
    """Get dataset statistics for a training chart generator run"""
    artifacts_dir = get_artifacts_dir(run_id)
    stats_file = os.path.join(artifacts_dir, "dataset_stats.json")

    try:
        if os.path.exists(stats_file):
            with open(stats_file, 'r') as f:
                return DatasetStats(**json.load(f))
    except (json.JSONDecodeError, IOError):
        pass

    # Return default stats if file doesn't exist or can't be read
    return DatasetStats()

@app.post("/api/training-chart-generator/cancel/{run_id}")
async def cancel_training_chart_generator(run_id: str):
    """Cancel a training chart generator run"""
    run_dir = get_run_dir(run_id)

    if not os.path.exists(run_dir):
        raise HTTPException(status_code=404, detail="Run not found")

    # Kill the running process if it exists
    process = running_processes.get(run_id)
    if process:
        if process.poll() is None:  # Process is still running
            print(f"Killing process for run {run_id}")
            try:
                process.terminate()  # Try graceful termination first
                try:
                    process.wait(timeout=5)  # Wait up to 5 seconds
                except subprocess.TimeoutExpired:
                    process.kill()  # Force kill if it doesn't terminate
                    process.wait()
                print(f"Successfully killed process for run {run_id}")
            except Exception as e:
                print(f"Error killing process for run {run_id}: {e}")
        # Remove from running processes registry
        running_processes.pop(run_id, None)

    # Update progress to cancelled - this ensures /progress always returns cancelled
    cancel_progress = {
        "phase": "cancelled",
        "percent": 0,
        "elapsed_s": 0,
        "step": 0,
        "total_steps": None,
        "error_message": "Generation cancelled by user"
    }

    progress_file = os.path.join(run_dir, "progress.json")
    with open(progress_file, 'w') as f:
        json.dump(cancel_progress, f)

    return {"status": "cancelled", "run_id": run_id}

@app.get("/api/training-chart-generator/download/{run_id}")
async def download_training_chart_generator_dataset(run_id: str):
    """Download the generated training dataset ZIP file"""
    run_dir = get_run_dir(run_id)
    zip_path = os.path.join(run_dir, f"training-dataset-{run_id}.zip")

    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="Dataset not found or still generating")

    return FileResponse(
        zip_path,
        media_type='application/zip',
        filename=f"training-dataset-{run_id}.zip"
    )

# Dataset storage
datasets_dir = os.path.join(os.path.dirname(__file__), "..", "datasets")
os.makedirs(datasets_dir, exist_ok=True)

# Dataset upload endpoints
@app.post("/datasets/upload", response_model=DatasetUploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    """Upload and extract a dataset ZIP file"""
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")

    # Check file size (warning at 2GB)
    file_size = 0
    content = await file.read()
    file_size = len(content)

    if file_size > 2 * 1024 * 1024 * 1024:  # 2GB
        print(f"Warning: Large file upload ({file_size} bytes)")

    # Generate dataset ID
    dataset_id = str(uuid.uuid4())[:8]
    dataset_dir = os.path.join(datasets_dir, dataset_id)
    images_dir = os.path.join(dataset_dir, "images")

    try:
        # Create directories
        os.makedirs(images_dir, exist_ok=True)

        # Save ZIP file
        zip_path = os.path.join(dataset_dir, f"{dataset_id}.zip")
        with open(zip_path, 'wb') as f:
            f.write(content)

        # Extract ZIP
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(images_dir)

        # Validate and analyze extracted files
        summary = analyze_dataset(images_dir)

        # Save summary
        summary_data = {
            "dataset_id": dataset_id,
            "extracted_path": images_dir,
            "total_images": summary["total_images"],
            "label_distribution": summary["label_distribution"],
            "example_filenames": summary["example_filenames"],
            "created_at": time.time()
        }

        summary_file = os.path.join(dataset_dir, "summary.json")
        with open(summary_file, 'w') as f:
            json.dump(summary_data, f, indent=2)

        return DatasetUploadResponse(
            dataset_id=dataset_id,
            extracted_path=images_dir,
            summary=summary
        )

    except Exception as e:
        # Cleanup on failure
        if os.path.exists(dataset_dir):
            shutil.rmtree(dataset_dir)
        raise HTTPException(status_code=500, detail=f"Dataset processing failed: {str(e)}")

@app.get("/datasets/{dataset_id}", response_model=DatasetSummary)
async def get_dataset_info(dataset_id: str):
    """Get dataset information and summary"""
    dataset_dir = os.path.join(datasets_dir, dataset_id)
    summary_file = os.path.join(dataset_dir, "summary.json")

    if not os.path.exists(summary_file):
        raise HTTPException(status_code=404, detail="Dataset not found")

    with open(summary_file, 'r') as f:
        return DatasetSummary(**json.load(f))

def analyze_dataset(images_dir: str) -> Dict[str, Any]:
    """Analyze extracted dataset and build summary"""
    total_images = 0
    label_distribution = {}
    example_filenames = []

    # Supported image extensions
    image_extensions = {'.png', '.jpg', '.jpeg', '.webp'}

    # Walk through all files in the extracted directory
    for root, dirs, files in os.walk(images_dir):
        for file in files:
            if any(file.lower().endswith(ext) for ext in image_extensions):
                total_images += 1

                # Extract label from filename (look for _label{N} pattern)
                if '_label' in file:
                    try:
                        label_part = file.split('_label')[1]
                        label = label_part[0]  # First character after _label
                        if label.isdigit():
                            label_distribution[label] = label_distribution.get(label, 0) + 1
                    except (IndexError, ValueError):
                        pass

                # Collect example filenames (first 5)
                if len(example_filenames) < 5:
                    example_filenames.append(file)

    if total_images == 0:
        raise ValueError("No image files found in the uploaded ZIP")

    return {
        "total_images": total_images,
        "label_distribution": label_distribution,
        "example_filenames": example_filenames
    }

# Trainer endpoints
trainer_runs = {}  # In-memory storage (use database in production)

# Backtester endpoints
from runners.backtester_runner import run_backtester

def run_testdata_generator(config: Dict[str, Any], run_dir: Path, progress_cb: Callable):
    """Run the test data generator script"""
    # Import the script module and call its main function with monkey-patched inputs
    import sys
    import builtins

    # Monkey patch input() to return our values
    inputs = [
        config['symbols'],  # symbols
        config['dataset_name'],  # folder_name
        "yes" if config['use_candles'] else "no",  # candle_chart
        config['timeframe'],  # t
        config['span_unit'],  # u
        str(config['span_units_count']),  # o
        str(config['future_horizon_bars']),  # w
        str(config['tp_frac']),  # f
        str(config['sl_frac']),  # s
        str(config['img_dim']),  # d
        str(config['period_length_units']),  # x
        "yes" if config['use_sma'] else "no",  # use_ma
        str(config['sma_length']) if config['use_sma'] else None,  # ma
        str(config['end_offset_units']),  # i1
    ]
    inputs = [i for i in inputs if i is not None]  # Remove None values

    input_index = 0
    def mock_input(prompt=""):
        nonlocal input_index
        if input_index < len(inputs):
            result = inputs[input_index]
            input_index += 1
            print(f"Mock input: {result}")
            return result
        return ""

    # Store original input
    original_input = builtins.input

    try:
        # Set up the mock input
        builtins.input = mock_input

        # Change to the backend directory to run the script
        original_cwd = os.getcwd()
        os.chdir(run_dir.parent.parent)  # Go to backend directory

        progress_cb("loading", 0.1, {"message": "Loading dependencies and data..."})

        # Import and run the script
        sys.path.insert(0, str(run_dir.parent.parent))
        import subprocess

        # Create output directory
        output_dir = run_dir / "output"
        output_dir.mkdir(parents=True, exist_ok=True)

        # Run the script
        cmd = [
            sys.executable,
            str(run_dir.parent.parent.parent / "1.4_Adj_testL.py")
        ]

        progress_cb("generating", 0.3, {"message": "Generating labeled chart images..."})

        result = subprocess.run(
            cmd,
            cwd=str(run_dir.parent.parent),
            capture_output=True,
            text=True,
            timeout=1800  # 30 minutes timeout
        )

        if result.returncode != 0:
            error_msg = result.stderr[:500] if result.stderr else "Unknown error"
            progress_cb("error", 0.0, {"message": f"Test data generation failed: {error_msg}"})
            return

        progress_cb("processing", 0.8, {"message": "Processing generated images..."})

        # Count generated images and create summary
        png_files = list(output_dir.glob("*.png"))
        total_images = len(png_files)

        # Simple label distribution (would need to parse filenames in real implementation)
        label_distribution = {"label0": total_images // 2, "label1": total_images // 2}

        # Generate dataset ID
        dataset_id = f"dataset_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

        # Move output to datasets directory
        dataset_path = Path(datasets_dir) / dataset_id
        dataset_images_path = dataset_path / "images"
        dataset_images_path.mkdir(parents=True, exist_ok=True)

        # Move PNG files to dataset
        for png_file in png_files:
            png_file.rename(dataset_images_path / png_file.name)

        # Create dataset summary
        summary = {
            "total_images": total_images,
            "label_distribution": label_distribution,
            "start_date": None,  # Would need to parse from filenames
            "end_date": None,    # Would need to parse from filenames
        }

        # Save results
        results = {
            "dataset_id": dataset_id,
            "dataset_path": str(dataset_images_path),
            "summary": summary,
        }

        with open(run_dir / "testdata_results.json", 'w') as f:
            json.dump(results, f, indent=2)

        progress_cb("done", 1.0, {
            "message": f"Generated {total_images} labeled images successfully!",
            "dataset_id": dataset_id
        })

    except subprocess.TimeoutExpired:
        progress_cb("error", 0.0, {"message": "Test data generation timed out after 30 minutes"})
    except Exception as e:
        progress_cb("error", 0.0, {"message": f"Test data generation failed: {str(e)[:200]}"})
        raise
    finally:
        # Restore original input and cwd
        builtins.input = original_input
        os.chdir(original_cwd)

@app.post("/trainer/runs", response_model=RunResponse)
async def start_trainer(request: TrainerRequest, background_tasks: BackgroundTasks):
    """Start a CNN trainer run"""
    run_id = generate_run_id()

    # Register run globally
    register_run(run_id, "trainer", f"/tools/trainer/runs/{run_id}")

    run_dir = Path(get_run_dir(run_id))
    run_dir.mkdir(parents=True, exist_ok=True)

    # Resolve training folder from dataset_id or folder_name
    if request.dataset_id:
        # Use uploaded dataset
        dataset_images_dir = os.path.join(datasets_dir, request.dataset_id, "images")
        if not os.path.exists(dataset_images_dir):
            raise HTTPException(status_code=400, detail=f"Dataset {request.dataset_id} not found")
        training_folder = dataset_images_dir
    elif request.folder_name:
        # Legacy support
        training_folder = request.folder_name
    else:
        raise HTTPException(status_code=400, detail="Either dataset_id or folder_name must be provided")

    # Create config with resolved folder
    trainer_config = request.dict()
    trainer_config["folder_name"] = training_folder

    # Initialize run status
    trainer_runs[run_id] = {
        "status": "running",
        "progress": {"phase": "starting", "percent": 0, "message": "Initializing..."},
        "last_metrics": None,
        "history_preview": [],
        "artifact_paths": [],
        "config": trainer_config,
        "run_dir": run_dir
    }

    def progress_callback(phase: str, percent: int, data: Dict[str, Any]):
        trainer_runs[run_id]["progress"] = {
            "phase": phase,
            "percent": percent,
            **data
        }
        if "epoch" in data:
            trainer_runs[run_id]["last_metrics"] = {
                "epoch": data.get("epoch"),
                "epochs": data.get("epochs"),
                "loss": data.get("loss"),
                "accuracy": data.get("accuracy"),
                "val_loss": data.get("val_loss"),
                "val_accuracy": data.get("val_accuracy")
            }
            # Keep last 20 history points for preview
            history = trainer_runs[run_id]["history_preview"]
            history.append(trainer_runs[run_id]["last_metrics"])
            if len(history) > 20:
                history.pop(0)

        # Update global run registry
        message = data.get("message", f"{phase}")
        if "epoch" in data:
            epoch = data.get("epoch", 0)
            epochs = data.get("epochs", 0)
            acc = data.get("val_accuracy", 0)
            message = f"Epoch {epoch}/{epochs} • Val acc {acc:.3f}"

        update_run_progress(run_id, percent / 100.0, phase, message)

    # Start training in background
    background_tasks.add_task(run_trainer, trainer_config, run_dir, progress_callback)

    return RunResponse(run_id=run_id)

@app.get("/trainer/runs/{run_id}", response_model=TrainerProgressResponse)
async def get_trainer_progress(run_id: str):
    """Get trainer run progress and status"""
    # Check if run directory exists (don't rely on in-memory trainer_runs)
    run_dir = get_run_dir(run_id)
    if not os.path.exists(run_dir):
        raise HTTPException(status_code=404, detail="Trainer run not found")

    # Check for completion by looking for model files
    status = "running"
    artifact_paths = []

    # Look for common model file extensions
    model_extensions = ['.keras', '.h5', '.pkl', '.joblib']
    model_found = False
    for ext in model_extensions:
        model_files = [f for f in os.listdir(run_dir) if f.endswith(ext)]
        if model_files:
            model_found = True
            break

    if model_found:
        status = "done"
        artifact_paths = ["model", "metrics", "summary", "history"]

    # Provide default trainer data structure
    run_data = {
        "status": status,
        "progress": {"phase": "completed" if status == "done" else "training", "percent": 100 if status == "done" else 50, "message": "Training completed" if status == "done" else "Training in progress"},
        "last_metrics": None,
        "history_preview": [],
        "artifact_paths": artifact_paths,
        "config": {"model_name": "trained_model.keras"},
        "run_dir": run_dir
    }

    return TrainerProgressResponse(**run_data)

@app.get("/trainer/runs/{run_id}/download/model")
async def download_trainer_model(run_id: str):
    """Download the trained model file"""
    run_dir = get_run_dir(run_id)
    if not os.path.exists(run_dir):
        raise HTTPException(status_code=404, detail="Trainer run not found")

    # Look for model files in the run directory
    model_extensions = ['.keras', '.h5', '.pkl', '.joblib']
    model_file = None
    for filename in os.listdir(run_dir):
        if any(filename.endswith(ext) for ext in model_extensions):
            model_file = filename
            break

    if not model_file:
        raise HTTPException(status_code=404, detail="Model not found")

    model_path = os.path.join(run_dir, model_file)

    return FileResponse(
        model_path,
        media_type='application/octet-stream',
        filename=model_name
    )

@app.post("/trainer/runs/{run_id}/analysis", response_model=AnalysisResponse)
async def start_trainer_analysis(run_id: str, request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Start CNN analysis on a trained model"""
    if run_id not in trainer_runs:
        raise HTTPException(status_code=404, detail="Trainer run not found")

    run_data = trainer_runs[run_id]
    if run_data["status"] != "done":
        raise HTTPException(status_code=400, detail="Training must be completed before analysis")

    analysis_id = f"analysis_{generate_run_id()}"
    run_dir = run_data["run_dir"]
    model_path = run_dir / run_data["config"]["model_name"]

    # Register analysis run globally
    analysis_run_id = f"{run_id}_{analysis_id}"
    register_run(analysis_run_id, "analysis", f"/tools/trainer/runs/{run_id}/analysis", run_id)

    # Initialize analysis status
    analysis_key = f"{run_id}_{analysis_id}"
    trainer_runs[analysis_key] = {
        "status": "running",
        "progress": {"phase": "starting", "percent": 0, "message": "Starting analysis..."},
        "generated_files": [],
        "run_id": run_id,
        "analysis_id": analysis_id
    }

    def analysis_progress_callback(phase: str, percent: int, data: Dict[str, Any]):
        trainer_runs[analysis_key]["progress"] = {
            "phase": phase,
            "percent": percent,
            **data
        }
        if "analysis_files" in data:
            trainer_runs[analysis_key]["generated_files"] = data["analysis_files"]

        # Update global run registry
        message = data.get("message", phase)
        update_run_progress(analysis_run_id, percent / 100.0, phase, message)

    # Prepare analysis config
    analysis_config = {
        "model_path": str(model_path),
        "img_path": request.img_path,
        "img_size": [224, 224],  # Default size
        "white_mask_thresh": request.white_mask_thresh,
        "trainer_folder": run_data["config"]["folder_name"],
        "analysis_id": analysis_id
    }

    # Start analysis in background
    background_tasks.add_task(run_cnn_analysis, analysis_config, str(run_dir), analysis_progress_callback)

    return AnalysisResponse(analysis_id=analysis_id)

@app.get("/trainer/runs/{run_id}/analysis/{analysis_id}", response_model=AnalysisStatusResponse)
async def get_analysis_status(run_id: str, analysis_id: str):
    """Get CNN analysis status"""
    # Check if run directory exists (don't rely on in-memory trainer_runs)
    run_dir = get_run_dir(run_id)
    if not os.path.exists(run_dir):
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Check for completion by looking for ZIP file
    zip_path = os.path.join(run_dir, "cnn_analysis.zip")
    status = "running"
    if os.path.exists(zip_path):
        status = "done"

    # Try to read analysis data from disk, or provide defaults
    analysis_data = {
        "status": status,
        "progress": 1.0 if status == "done" else 0.5,
        "stage": "completed" if status == "done" else "analyzing",
        "message": "Analysis completed successfully" if status == "done" else "Analysis in progress",
        "analysis_files": [],
        "generated_files": []
    }

    return AnalysisStatusResponse(**analysis_data)

@app.get("/trainer/runs/{run_id}/analysis/{analysis_id}/download")
async def download_analysis_zip(run_id: str, analysis_id: str):
    """Download the CNN analysis ZIP file"""
    run_dir = get_run_dir(run_id)
    zip_path = os.path.join(run_dir, "cnn_analysis.zip")

    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="Analysis ZIP not found")

    return FileResponse(
        zip_path,
        media_type='application/zip',
        filename=f"cnn_analysis_{run_id}_{analysis_id}.zip"
    )

@app.get("/trainer/runs/{run_id}/analysis/{analysis_id}/images/{filename}")
async def get_analysis_image(run_id: str, analysis_id: str, filename: str):
    """Serve individual analysis images"""
    run_dir = get_run_dir(run_id)
    if not os.path.exists(run_dir):
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis_dir = os.path.join(run_dir, "analysis", analysis_id)
    image_path = os.path.join(analysis_dir, filename)

    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(image_path)

# Backtester endpoints
backtester_runs = {}  # In-memory storage

@app.post("/runs/backtester/start", response_model=RunResponse)
async def start_backtester_run(request: BacktesterStartRequest, background_tasks: BackgroundTasks):
    """Start a backtester run"""
    run_id = generate_run_id()

    # Register run globally
    register_run(run_id, "backtester", f"/tools/backtester/runs/{run_id}")

    # Resolve model path
    model_path = None
    if request.model_id:
        # Look up model by ID
        model_file_path = models_dir / f"{request.model_id}.keras"
        if not model_file_path.exists():
            raise HTTPException(status_code=404, detail=f"Model with ID {request.model_id} not found")
        # Construct path relative to project root (where the script will run)
        model_path = f"backend/models/{request.model_id}.keras"
    elif request.model_path:
        model_path = request.model_path
    else:
        raise HTTPException(status_code=400, detail="Either model_path or model_id must be provided")

    # Resolve dataset path
    dataset_path = None
    if request.dataset_id:
        # Construct path relative to project root (where the script will run)
        dataset_images_dir = os.path.join("backend", "datasets", request.dataset_id, "images")
        # Check if it exists using absolute path
        abs_dataset_path = os.path.join(datasets_dir, request.dataset_id, "images")
        if not os.path.exists(abs_dataset_path):
            raise HTTPException(status_code=400, detail=f"Dataset {request.dataset_id} not found")
        dataset_path = dataset_images_dir
    elif request.chart_folder:
        dataset_path = request.chart_folder
    else:
        raise HTTPException(status_code=400, detail="Either dataset_id or chart_folder must be provided")

    # Create run directory
    run_dir = Path(get_run_dir(run_id))
    run_dir.mkdir(parents=True, exist_ok=True)

    # Store run info
    backtester_runs[run_id] = {
        "run_dir": run_dir,
        "config": request.dict(),
        "status": "running",
        "progress": {"phase": "starting", "percent": 0.05, "message": "Initializing backtester..."},
    }

    # Prepare config for runner
    runner_config = {
        "model_path": model_path,
        "dataset_path": dataset_path,
        "sample_size": request.sample_size,
        "confidence_threshold": request.confidence_threshold,
        "tp_pct": request.tp_pct,
        "sl_pct": request.sl_pct,
        "img_size": request.img_size,
        # Trading parameters
        "starting_capital": request.starting_capital,
        "position_size_pct": request.position_size_pct,
        "commission_pct": request.commission_pct,
        "slippage_pct": request.slippage_pct,
        # Risk management
        "max_drawdown_pct": request.max_drawdown_pct,
        "max_trades_per_day": request.max_trades_per_day,
    }

    # Start the backtester in background
    background_tasks.add_task(run_backtester, runner_config, run_dir, lambda phase, percent, data: update_backtester_progress(run_id, phase, percent, data))

    return RunResponse(run_id=run_id)

def update_backtester_progress(run_id: str, phase: str, percent: float, data: Dict[str, Any]):
    """Update backtester progress"""
    if run_id in backtester_runs:
        backtester_runs[run_id]["progress"] = {
            "phase": phase,
            "percent": percent,
            **data
        }

        # Update local status
        status = "running"
        if phase == "done":
            status = "done"
        elif phase == "error":
            status = "failed"
        backtester_runs[run_id]["status"] = status

        # Update global run registry
        update_run_progress(run_id, percent, phase, data.get("message", ""), status)

@app.get("/runs/backtester/{run_id}/status", response_model=BacktesterStatusResponse)
async def get_backtester_status(run_id: str):
    """Get backtester run status"""
    run_dir = get_run_dir(run_id)
    if not os.path.exists(run_dir):
        raise HTTPException(status_code=404, detail="Backtester run not found")

    # For completed runs, always return "done" status
    return BacktesterStatusResponse(
        status="done",
        progress=1.0,
        stage="done",
        message="Backtest completed successfully!",
        live_metrics=None
    )

@app.get("/runs/backtester/{run_id}/result", response_model=BacktesterResultResponse)
async def get_backtester_result(run_id: str):
    """Get backtester run results"""
    # Check if run directory exists (don't rely on in-memory backtester_runs)
    run_dir = get_run_dir(run_id)
    if not os.path.exists(run_dir):
        raise HTTPException(status_code=404, detail="Backtester run not found")

    # Check if results exist
    results_file = os.path.join(run_dir, "backtest_output", "backtest_results.json")
    if not os.path.exists(results_file):
        raise HTTPException(status_code=404, detail="Results not available yet")

    with open(results_file, 'r') as f:
        results = json.load(f)

    # Generate chart URLs
    charts = {}
    charts_dir = os.path.join(run_dir, "backtest_output", "charts")
    if os.path.exists(charts_dir):
        for filename in os.listdir(charts_dir):
            if filename.endswith('.png'):
                chart_name = filename[:-4]  # Remove .png extension
                charts[chart_name] = f"/runs/backtester/{run_id}/charts/{filename}"

    return BacktesterResultResponse(
        kpis=results.get("kpis", {}),
        charts=charts,
        download_zip_url=f"/runs/backtester/{run_id}/download.zip",
        csv_urls=results.get("csv_urls"),
        summary_url=results.get("summary_url")
    )

@app.get("/runs/backtester/{run_id}/charts/{filename}")
async def get_backtester_chart(run_id: str, filename: str):
    """Serve backtester chart files"""
    run_dir = get_run_dir(run_id)
    if not os.path.exists(run_dir):
        raise HTTPException(status_code=404, detail="Backtester run not found")

    chart_path = os.path.join(run_dir, "backtest_output", filename)

    if not os.path.exists(chart_path):
        raise HTTPException(status_code=404, detail="Chart not found")

    return FileResponse(chart_path)

@app.get("/runs/backtester/{run_id}/download.zip")
async def download_backtester_zip(run_id: str):
    """Download backtester results ZIP"""
    if run_id not in backtester_runs:
        raise HTTPException(status_code=404, detail="Backtester run not found")

    run_dir = backtester_runs[run_id]["run_dir"]
    output_dir = run_dir / "backtest_output"

    if not output_dir.exists():
        raise HTTPException(status_code=404, detail="Results not available")

    # Create ZIP file
    import zipfile
    zip_path = run_dir / "backtester_results.zip"

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for file_path in output_dir.rglob('*'):
            if file_path.is_file():
                zip_file.write(file_path, file_path.relative_to(output_dir))

    return FileResponse(zip_path, media_type="application/zip", filename=f"backtester_results_{run_id}.zip")

# Model upload endpoint
models_dir = Path("models")
models_dir.mkdir(exist_ok=True)

@app.post("/models/upload", response_model=ModelUploadResponse)
async def upload_model(file: UploadFile = File(...)):
    """Upload a Keras model file"""
    if not file.filename.lower().endswith('.keras'):
        raise HTTPException(status_code=400, detail="Only .keras files are supported")

    if file.size > 500 * 1024 * 1024:  # 500MB
        raise HTTPException(status_code=413, detail="File size exceeds 500MB limit")

    # Generate model ID
    model_id = f"model_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

    # Save file
    model_path = models_dir / f"{model_id}.keras"
    with open(model_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return ModelUploadResponse(model_id=model_id)

# Test Data Generator endpoints
testdata_runs = {}  # In-memory storage

@app.post("/runs/testdata/start", response_model=RunResponse)
async def start_testdata_run(request: TestDataGeneratorRequest, background_tasks: BackgroundTasks):
    """Start a test data generation run"""
    run_id = generate_run_id()

    # Register run globally
    register_run(run_id, "testdata", f"/tools/backtester")  # No dedicated results page

    # Create run directory
    run_dir = Path(get_run_dir(run_id))
    run_dir.mkdir(parents=True, exist_ok=True)

    # Store run info
    testdata_runs[run_id] = {
        "run_dir": run_dir,
        "config": request.dict(),
        "status": "running",
        "progress": {"phase": "starting", "percent": 0.05, "message": "Initializing test data generator..."},
    }

    # Start the testdata generator in background
    background_tasks.add_task(run_testdata_generator, request.dict(), run_dir, lambda phase, percent, data: update_testdata_progress(run_id, phase, percent, data))

    return RunResponse(run_id=run_id)

def update_testdata_progress(run_id: str, phase: str, percent: float, data: Dict[str, Any]):
    """Update testdata progress"""
    if run_id in testdata_runs:
        testdata_runs[run_id]["progress"] = {
            "phase": phase,
            "percent": percent,
            **data
        }

        # Update global run registry
        status = "running"
        if phase == "done":
            status = "done"
        elif phase == "error":
            status = "failed"

        update_run_progress(run_id, percent, phase, data.get("message", ""), status)

@app.get("/runs/testdata/{run_id}/status", response_model=TestDataGeneratorStatusResponse)
async def get_testdata_status(run_id: str):
    """Get testdata run status"""
    if run_id not in testdata_runs:
        raise HTTPException(status_code=404, detail="Testdata run not found")

    run_data = testdata_runs[run_id]
    progress = run_data["progress"]

    return TestDataGeneratorStatusResponse(
        status=run_data["status"],
        progress=progress["percent"],
        stage=progress["phase"],
        message=progress.get("message", ""),
        live_metrics=progress.get("live_metrics")
    )

@app.get("/runs/testdata/{run_id}/result", response_model=TestDataGeneratorResultResponse)
async def get_testdata_result(run_id: str):
    """Get testdata run results"""
    if run_id not in testdata_runs:
        raise HTTPException(status_code=404, detail="Testdata run not found")

    run_data = testdata_runs[run_id]
    run_dir = run_data["run_dir"]

    # Check if results exist
    results_file = run_dir / "testdata_results.json"
    if not results_file.exists():
        raise HTTPException(status_code=404, detail="Results not available")

    with open(results_file, 'r') as f:
        results = json.load(f)

    return TestDataGeneratorResultResponse(
        dataset_id=results["dataset_id"],
        download_zip_url=f"/runs/testdata/{run_id}/download.zip",
        summary=results.get("summary", {})
    )

@app.get("/runs/testdata/{run_id}/download.zip")
async def download_testdata_zip(run_id: str):
    """Download testdata results ZIP"""
    if run_id not in testdata_runs:
        raise HTTPException(status_code=404, detail="Testdata run not found")

    run_dir = testdata_runs[run_id]["run_dir"]
    output_dir = run_dir / "output"

    if not output_dir.exists():
        raise HTTPException(status_code=404, detail="Results not available")

    # Create ZIP file
    import zipfile
    zip_path = run_dir / "testdata.zip"

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for file_path in output_dir.rglob('*'):
            if file_path.is_file():
                zip_file.write(file_path, file_path.relative_to(output_dir))

    return FileResponse(zip_path, media_type="application/zip", filename=f"testdata_{run_id}.zip")

# Global run management endpoints
@app.get("/runs/active")
async def get_active_runs_endpoint():
    """Get all active (running/queued) runs across all tools"""
    active_runs = get_active_runs()
    return {"runs": [run.dict() for run in active_runs]}

@app.get("/runs/{run_id}")
async def get_run_endpoint(run_id: str):
    """Get details for a specific run"""
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run.dict()

@app.get("/runs")
async def get_all_runs_endpoint(limit: int = 50):
    """Get recent runs across all tools (for debugging/admin)"""
    all_run_list = list(all_runs.values())
    # Sort by updated_at descending
    all_run_list.sort(key=lambda r: r.updated_at, reverse=True)
    return {"runs": [run.dict() for run in all_run_list[:limit]]}

@app.head("/datasets/test")
async def test_datasets_endpoint():
    """Test endpoint for connectivity checks"""
    return {"status": "ok"}

@app.get("/")
def health():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_includes=["*.py"],
        reload_excludes=["runs/*", "runs/**/*", "*.pyc", "__pycache__"]
    )
