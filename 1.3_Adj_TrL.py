import os
import datetime as dt
from dateutil.relativedelta import relativedelta
import time
import sys
import argparse
import json

import yfinance as yf
import pandas as pd
import plotly.graph_objects as go


class ProgressWriter:
    def __init__(self, path: str, timeseries_path: str | None = None, total_steps: int | None = None):
        self.path = path
        self.timeseries_path = timeseries_path
        self.start = time.time()
        self.total_steps = total_steps

    def update(self, phase: str, percent: float | None = None, step: int | None = None):
        now = time.time()
        elapsed = now - self.start
        payload = {
            "phase": phase,
            "percent": percent,
            "elapsed_s": round(elapsed, 2),
            "updated_at": now,
            "step": step,
            "total_steps": self.total_steps,
        }
        with open(self.path, "w") as f:
            json.dump(payload, f)

        # Append to timeseries JSONL if configured
        if self.timeseries_path is not None:
            try:
                with open(self.timeseries_path, "a") as f_ts:
                    f_ts.write(json.dumps(payload) + "\n")
            except OSError:
                # If we can't append, skip silently; main progress.json is enough.
                pass


def tp_first_else_zero_from_next_open(data, future_data, f, s):
    """
    Label based on a trade ENTERING at the NEXT OPEN after the chart window.

    - Entry price = first future bar's Open (or Close if Open missing)
    - TP / SL levels are defined from that entry price.
    - Then we walk forward through future bars and see whether SL or TP
      is hit first (intrabar via Low/High).
    """

    if data.empty or future_data.empty:
        return None, None, None, None

    has_open = 'Open' in future_data and not future_data['Open'].empty
    has_high = 'High' in future_data and not future_data['High'].empty
    has_low  = 'Low'  in future_data and not future_data['Low'].empty

    # Entry bar = first future bar after last_bar_ts
    first_row = future_data.iloc[0]

    entry_price = float(first_row['Open']) if has_open else float(first_row.get('Close'))
    if entry_price is None:
        return None, None, None, None

    tp_level = entry_price * (1.0 + float(f))
    sl_level = entry_price * (1.0 - float(s))

    # Walk through future bars (including entry bar)
    for ts, row in future_data.iterrows():
        h = float(row['High']) if has_high else float(row.get('Close', entry_price))
        l = float(row['Low'])  if has_low  else float(row.get('Close', entry_price))

        # Conservative convention: SL first, then TP
        if l <= sl_level:
            return 0, sl_level, 'SL', ts
        if h >= tp_level:
            return 1, tp_level, 'TP', ts

    # Neither TP nor SL within the horizon
    return 0, None, None, None


def inclusive_history(ticker, start_ts, end_ts, interval):
    """
    yfinance's 'end' is exclusive; add +1 day to include intended end bar.
    Returns a DataFrame with tz-aware index (as provided by yfinance).
    """
    df = ticker.history(
        start=start_ts.strftime('%Y-%m-%d'),
        end=(end_ts + dt.timedelta(days=1)).strftime('%Y-%m-%d'),
        interval=interval
    )
    return df


def first_w_trading_bars_after(ticker, last_bar_ts, w, interval):
    """
    Build a future window of the first w trading bars STRICTLY AFTER last_bar_ts.
    Pull a generous calendar buffer to cover weekends/holidays, then cut.
    """
    raw = ticker.history(
        start=(last_bar_ts - dt.timedelta(days=3)).strftime('%Y-%m-%d'),
        end=(last_bar_ts + dt.timedelta(days=w*5)).strftime('%Y-%m-%d'),
        interval=interval
    )
    if raw.empty:
        return raw

    # Ensure timezone compatibility when comparing
    idx = raw.index
    if hasattr(idx, 'tz') and idx.tz is not None:
        cutoff = (pd.Timestamp(last_bar_ts).tz_convert(idx.tz)
                  if getattr(last_bar_ts, 'tz', None)
                  else pd.Timestamp(last_bar_ts).tz_localize(idx.tz))
    else:
        cutoff = (pd.Timestamp(last_bar_ts).tz_localize(None)
                  if getattr(last_bar_ts, 'tz', None)
                  else pd.Timestamp(last_bar_ts))

    future = raw.loc[idx > cutoff].head(w)
    return future


def parse_args():
    parser = argparse.ArgumentParser(description='Generate labeled training charts')
    parser.add_argument('--symbols', required=True, help='Symbols (comma separated)')
    parser.add_argument('--x', type=int, required=True, help='Charts per symbol per label')
    parser.add_argument('--out_dir', required=True, help='Output directory')
    parser.add_argument('--use_candles', required=True, help='Use candlechart (yes/no)')
    parser.add_argument('--t', required=True, help='Timeframe (1d, 1wk, 1mo)')
    parser.add_argument('--u', required=True, help='Unit of timespan (e.g. months)')
    parser.add_argument('--o', type=int, required=True, help='How many units for the timespan')
    parser.add_argument('--w', type=int, required=True, help='Future horizon in bars')
    parser.add_argument('--f', type=float, required=True, help='Take Profit (as fraction)')
    parser.add_argument('--s', type=float, required=True, help='Stop loss')
    parser.add_argument('--img_dim', type=int, required=True, help='Image dimensions')
    parser.add_argument('--i1', type=int, required=True, help='Last chart ends n time frame units ago')
    parser.add_argument('--run_id', required=True, help='Run ID')
    parser.add_argument('--progress_dir', required=True, help='Directory for progress files')

    return parser.parse_args()


def generate_and_save_labeled_charts(symbols, x, out_dir, use_candles, t, u, o, w, f, s, img_dim, i1, progress=None):
    print("=== Training Chart Generator Started ===")
    # --- Inputs from arguments ---
    symbols = symbols.upper().replace(" ", "").split(",")
    print(f"Configuration: symbols={symbols}, charts_per_label={x}, out_dir={out_dir}")

    print(f"Configuration: symbols={symbols}, charts_per_label={x}, timeframe={t}, use_candles={use_candles}")
    print(f"Output directory: {out_dir}")

    os.makedirs(out_dir, exist_ok=True)
    print(f"Created output directory: {out_dir}")

    if progress:
        progress.update("initializing", percent=5.0)

    # step unit for the sliding 'current_end'
    if t == "1d":
        step_unit = "days"
    elif t == "1wk":
        step_unit = "weeks"
    elif t == "1mo":
        step_unit = "months"
    else:
        raise ValueError("Unsupported timeframe. Use '1d', '1wk', or '1mo'.")

    print(f"Processing {len(symbols)} symbols: {symbols}")
    for symbol_idx, symbol in enumerate(symbols):
        print(f"Starting symbol {symbol_idx + 1}/{len(symbols)}: {symbol}")

        if progress:
            # Calculate overall progress based on symbol completion
            symbol_progress = (symbol_idx / len(symbols)) * 90 + 10  # 10-100% range
            progress.update(f"processing_symbol_{symbol}", percent=symbol_progress)
        ticker = yf.Ticker(symbol)
        label_counts = {0: 0, 1: 0}
        used_last_bars = set()   # ensure max 1 trade per trading bar
        i = i1

        chart_count = 0
        while min(label_counts.values()) < x:
            chart_count += 1
            if chart_count % 50 == 0:  # Log every 50 charts
                print(f"Symbol {symbol}: Generated {chart_count} charts so far (labels: {label_counts})")

            # Define requested start/end for the chart window
            today = dt.datetime.today()
            current_end_req = today - relativedelta(**{step_unit: i})
            current_start_req = current_end_req - relativedelta(**{u: o})
            i += 1

            # Pull chart data (inclusive end)
            data = inclusive_history(ticker, current_start_req, current_end_req, t)
            if data.empty or 'Close' not in data:
                continue

            # True last bar timestamp from returned data
            last_bar_ts = data.index[-1]

            # NEW: ensure only ONE chart / trade per last_bar_ts (per trading day)
            if last_bar_ts in used_last_bars:
                continue
            used_last_bars.add(last_bar_ts)

            # Convert to a plain date for filename (keeps your previous naming style consistent)
            if getattr(last_bar_ts, 'tz', None):
                last_bar_date = last_bar_ts.tz_convert('America/New_York').date()
            else:
                last_bar_date = last_bar_ts.date()

            # Build future window: first w trading bars STRICTLY after last_bar_ts
            future = first_w_trading_bars_after(ticker, last_bar_ts, w, t)
            if future.empty:
                continue

            # Decide label + collect hit info (entry from NEXT OPEN)
            label, hit_price, which, hit_date = tp_first_else_zero_from_next_open(data, future, f, s)
            if label is None:
                continue

            # Keep target distribution
            if label == 1 and label_counts[1] < x:
                final_label = 1
            elif label == 0 and label_counts[0] < x:
                final_label = 0
            else:
                continue

            # --- Render chart (candles or line) ---
            try:
                # Validate data before creating figure
                if data.empty or len(data) < 2:
                    print(f"Skipping {symbol} at {last_bar_date}: insufficient data")
                    continue

                if 'Close' not in data or data['Close'].empty:
                    print(f"Skipping {symbol} at {last_bar_date}: no close prices")
                    continue

                fig = go.Figure()
                if use_candles.lower() == "yes":
                    # Ensure we have OHLC data
                    if 'Open' in data and 'High' in data and 'Low' in data and 'Close' in data:
                        fig.add_trace(go.Candlestick(
                            x=data.index,
                            open=data['Open'], high=data['High'],
                            low=data['Low'], close=data['Close'],
                            name='Candlestick'
                        ))
                    else:
                        # Fallback to line chart if OHLC data is missing
                        fig.add_trace(go.Scatter(
                            x=data.index, y=data['Close'],
                            mode='lines',
                            line=dict(color='black', width=1),
                            name='Close Price'
                        ))
                else:
                    fig.add_trace(go.Scatter(
                        x=data.index, y=data['Close'],
                        mode='lines',
                        line=dict(color='black', width=1),
                        name='Close Price'
                    ))

                fig.update_layout(
                    xaxis=dict(visible=False),
                    yaxis=dict(visible=False),
                    showlegend=False,
                    margin=dict(l=0, r=0, t=0, b=0),
                    plot_bgcolor='rgba(0,0,0,0)',
                    paper_bgcolor='rgba(0,0,0,0)',
                    xaxis_rangeslider_visible=False,
                    width=img_dim, height=img_dim
                )

                filename = f"{out_dir}/{symbol}_{current_start_req.date()}_to_{last_bar_date}_label{final_label}.png"

                # Ensure the directory exists
                os.makedirs(os.path.dirname(filename), exist_ok=True)

                # Write image with error handling
                fig.write_image(filename, format="png", width=img_dim, height=img_dim)

            except Exception as e:
                print(f"Error creating chart for {symbol} at {last_bar_date}: {str(e)}")
                continue
            label_counts[final_label] += 1

            # Update progress after each chart
            if progress and chart_count % 10 == 0:  # Update every 10 charts to avoid too frequent updates
                current_progress = min(95, (symbol_idx / len(symbols)) * 90 + 10 + (chart_count / (x * 2)) * 5)  # Conservative estimate
                progress.update(f"generating_charts_{symbol}", percent=current_progress)

            # For audit: base close and actual entry price
            base = float(data['Close'].iloc[-1])
            if 'Open' in future and not future['Open'].empty:
                entry = float(future['Open'].iloc[0])
            else:
                entry = float(future['Close'].iloc[0])

            print(
                f"Saved: {filename} ({label_counts[final_label]}/{x} for label {final_label}) | "
                f"base_close={base:.4f} | entry={entry:.4f} | "
                f"hit={which or 'None'} | hit_price={hit_price} | hit_date={hit_date}"
            )

        total = len([f for f in os.listdir(out_dir) if f.endswith('.png') and symbol in f])
        print(f"Done with symbol {symbol}. Total charts: {total} (labels: {label_counts})")

    print("=== Training Chart Generator Completed ===")
    overall_total = len([f for f in os.listdir(out_dir) if f.endswith('.png')])
    print(f"Overall total charts generated: {overall_total}")


if __name__ == "__main__":
    args = parse_args()

    # Set up progress reporting
    progress = ProgressWriter(
        path=os.path.join(args.progress_dir, "progress.json"),
        timeseries_path=os.path.join(args.progress_dir, "progress_timeseries.jsonl"),
    )
    progress.update("starting", percent=0.0)

    try:
        generate_and_save_labeled_charts(
            symbols=args.symbols,
            x=args.x,
            out_dir=args.out_dir,
            use_candles=args.use_candles,
            t=args.t,
            u=args.u,
            o=args.o,
            w=args.w,
            f=args.f,
            s=args.s,
            img_dim=args.img_dim,
            i1=args.i1,
            progress=progress
        )
        progress.update("done", percent=100.0)
        print("Chart generation completed successfully!")
    except Exception as e:
        print(f"Error during chart generation: {e}")
        progress.update("error", percent=0.0, error_message=str(e))
        raise
