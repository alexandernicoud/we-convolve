import os
import numpy as np
import matplotlib as mpl
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import cv2
import tensorflow as tf
from tensorflow.keras import Model
from pathlib import Path
from typing import Callable, Dict, Any
import json
import time

# ========= UNIFIED COLORMAP =========
CONVOLVE_CMAP = LinearSegmentedColormap.from_list(
    "convolve_cmap",
    [
        (0.00, "#05040D"),  # near-black indigo
        (0.18, "#1B1464"),  # deep indigo
        (0.40, "#2E3AEE"),  # electric blue
        (0.62, "#8B5CF6"),  # vivid purple
        (0.82, "#EC4899"),  # hot pink
        (1.00, "#FFD1F2"),  # soft pink highlight
    ],
    N=256
)

# ========= STYLING =========
PALETTE = {
    "fg": "#E7E9FF",
    "muted": "#9AA3C7",
    "purple": "#8B5CF6",
    "blue": "#3B82F6",
    "pink": "#EC4899",
}

def apply_dark_style():
    plt.style.use("dark_background")
    mpl.rcParams.update({
        "figure.facecolor": "none",
        "axes.facecolor": "none",
        "savefig.facecolor": "none",
        "text.color": PALETTE["fg"],
        "axes.labelcolor": PALETTE["muted"],
        "xtick.color": PALETTE["muted"],
        "ytick.color": PALETTE["muted"],
        "axes.edgecolor": "none",
        "grid.color": PALETTE["muted"],
        "grid.alpha": 0.15,
        "font.family": "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    })

def save_fig_png(path_png: str, fig=None):
    if fig is None:
        fig = plt.gcf()

    # Ensure transparent background and clean styling
    fig.patch.set_alpha(0.0)
    for ax in fig.axes:
        ax.set_facecolor("none")
        ax.axis("off")  # Remove axes completely
        # Remove all spines
        for spine in ax.spines.values():
            spine.set_visible(False)
        # Remove ticks and labels
        ax.set_xticks([])
        ax.set_yticks([])
        ax.set_xlabel("")
        ax.set_ylabel("")

    # Clean export with no margins
    plt.tight_layout(pad=0.1)
    fig.savefig(
        path_png,
        format="png",
        transparent=True,
        bbox_inches="tight",
        pad_inches=0.05,
        dpi=250
    )


def run_cnn_analysis(config: Dict[str, Any], run_dir: str, progress_cb: Callable):
    """Run CNN analysis on trained model"""

    model_path = config['model_path']
    img_path = config.get('img_path', None)  # Optional, will auto-select if not provided
    img_size = tuple(config.get('img_size', [224, 224]))
    analysis_id = config.get('analysis_id', 'default')
    run_dir_path = Path(run_dir)
    out_dir = run_dir_path / "analysis" / analysis_id

    # Apply dark styling
    apply_dark_style()

    progress_cb("starting", 0, {"message": "Starting CNN analysis..."})

    try:
        # Create output directory
        out_dir.mkdir(parents=True, exist_ok=True)

        # Load model
        progress_cb("loading", 10, {"message": "Loading trained model..."})
        model = tf.keras.models.load_model(model_path)

        def get_seq_or_inner(model):
            if isinstance(model, tf.keras.Sequential):
                return model
            try:
                return model.get_layer("sequential")
            except Exception:
                return model

        seq = get_seq_or_inner(model)
        print(f"✅ Model loaded: {model_path}")

        # Auto-select image if not provided
        if not img_path:
            # Look for any PNG file in the training folder (from trainer config)
            trainer_folder = config.get('trainer_folder', '')
            if trainer_folder and os.path.exists(trainer_folder):
                png_files = [f for f in os.listdir(trainer_folder) if f.endswith('.png')]
                if png_files:
                    img_path = os.path.join(trainer_folder, png_files[0])
                    print(f"Auto-selected image: {img_path}")
                else:
                    raise FileNotFoundError("No PNG images found in training folder")
            else:
                raise FileNotFoundError("No image path provided and no training folder available")

        # Load and preprocess image
        progress_cb("loading", 20, {"message": "Loading and preprocessing image..."})
        img = tf.keras.utils.load_img(img_path, target_size=img_size)
        img_arr = tf.keras.utils.img_to_array(img)
        img_arr = np.expand_dims(img_arr, axis=0) / 255.0

        def list_conv_layers(seq):
            return [lyr for lyr in seq.layers if isinstance(lyr, tf.keras.layers.Conv2D)]

        conv_layers = list_conv_layers(seq)

        # Helper functions
        def save_fig(fig, name):
            path = out_dir / name
            save_fig_png(str(path), fig)
            plt.close(fig)
            print(f"💾 Saved: {path}")

        def build_forward_upto(seq, target_layer_name, img_shape):
            inp = tf.keras.Input(shape=(img_shape[0], img_shape[1], 3))
            x = inp
            for lyr in seq.layers:
                x = lyr(x)
                if lyr.name == target_layer_name:
                    break
            return Model(inputs=inp, outputs=x)

        def grid_shape(n, prefer_cols=8):
            cols = min(prefer_cols, max(1, n))
            rows = int(np.ceil(n / cols))
            return rows, cols

        # 1) Filter visualizations
        progress_cb("analyzing", 30, {"message": "Generating filter visualizations..."})
        all_w = []
        for L in conv_layers:
            w, _ = L.get_weights()
            all_w.append(w.flatten())
        all_w_flat = np.concatenate(all_w)
        global_wmin, global_wmax = all_w_flat.min(), all_w_flat.max()

        for i, L in enumerate(conv_layers):
            w, _ = L.get_weights()
            n = min(w.shape[-1], 8)  # MAX_FILTERS_TO_SHOW = 8
            fig, axes = plt.subplots(2, 4, figsize=(12, 6))
            axes = axes.flatten()
            for j in range(n):
                f = np.mean(w[:, :, :, j], axis=-1)
                im = axes[j].imshow(f, cmap=CONVOLVE_CMAP, vmin=global_wmin, vmax=global_wmax)
                axes[j].set_title(f"Filter {j+1}", fontsize=9)
                axes[j].axis("off")
                plt.colorbar(im, ax=axes[j], fraction=0.046, pad=0.04, label="Weights")
            for j in range(n, len(axes)):
                axes[j].axis("off")
            fig.suptitle(f"Filters – {L.name}", fontsize=14)
            plt.subplots_adjust(wspace=0.5, hspace=0.5)
            save_fig(fig, f"filter_{L.name}.png")

        # 2) Activation maps
        progress_cb("analyzing", 50, {"message": "Generating activation maps..."})
        for idx, L in enumerate(conv_layers):
            act_model = build_forward_upto(seq, L.name, img_size)
            acts = act_model.predict(img_arr, verbose=0)
            Fmaps = acts.shape[-1]

            # Mean activation
            mean_act = np.mean(acts[0], axis=-1)
            fig, ax = plt.subplots(figsize=(5, 4))
            im = ax.imshow(mean_act, cmap=CONVOLVE_CMAP, vmin=0, vmax=np.percentile(mean_act, 99))
            ax.set_title(f"Mean Activation – {L.name}")
            ax.axis("off")
            fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="Activation")
            save_fig(fig, f"mean_activation_{L.name}.png")

            # Individual activation maps
            if idx == 0:
                # Show all maps for first layer
                rows, cols = grid_shape(Fmaps, prefer_cols=8)
                fig, axes = plt.subplots(rows, cols, figsize=(3*cols, 3*rows))
                axes = axes.flatten()
                for i in range(Fmaps):
                    a = acts[0, :, :, i]
                    im = axes[i].imshow(a, cmap=CONVOLVE_CMAP, vmin=0, vmax=np.percentile(a, 99))
                    axes[i].set_title(f"Map {i+1}", fontsize=8)
                    axes[i].axis("off")
                    plt.colorbar(im, ax=axes[i], fraction=0.046, pad=0.04)
                for j in range(Fmaps, len(axes)):
                    axes[j].axis("off")
                fig.suptitle(f"Activations – {L.name} (All Maps)", fontsize=14)
                plt.subplots_adjust(wspace=0.4, hspace=0.4)
                save_fig(fig, f"activations_{L.name}.png")
            else:
                # Show subset for other layers
                n_show = min(Fmaps, 8)  # MAX_MAPS_TO_SHOW = 8
                fig, axes = plt.subplots(2, 4, figsize=(12, 6))
                axes = axes.flatten()
                for i in range(n_show):
                    a = acts[0, :, :, i]
                    im = axes[i].imshow(a, cmap=CONVOLVE_CMAP, vmin=0, vmax=np.percentile(a, 99))
                    axes[i].set_title(f"Map {i+1}", fontsize=8)
                    axes[i].axis("off")
                    plt.colorbar(im, ax=axes[i], fraction=0.046, pad=0.04)
                for j in range(n_show, len(axes)):
                    axes[j].axis("off")
                fig.suptitle(f"Activations – {L.name}", fontsize=14)
                plt.subplots_adjust(wspace=0.4, hspace=0.4)
                save_fig(fig, f"activations_{L.name}.png")

        # 3) Grad-CAM
        progress_cb("analyzing", 70, {"message": "Generating Grad-CAM analysis..."})
        last_conv = conv_layers[-1].name
        print(f"Last conv layer: {last_conv}")

        inp_gc = tf.convert_to_tensor(img_arr, dtype=tf.float32)
        grad_model = build_forward_upto(seq, last_conv, img_size)

        with tf.GradientTape() as tape:
            tape.watch(inp_gc)
            conv_out = grad_model(inp_gc)
            x = conv_out
            passed = False
            for lyr in seq.layers:
                if lyr.name == last_conv:
                    passed = True
                    continue
                if passed:
                    x = lyr(x)
            preds = x
            loss = tf.reduce_sum(preds)

        grads = tape.gradient(loss, conv_out)
        pooled = tf.reduce_mean(grads, axis=(0, 1, 2))
        heat = tf.reduce_mean(conv_out * pooled, axis=-1)[0].numpy()
        heat = (heat - heat.min()) / (heat.max() - heat.min() + 1e-8)

        # Save raw Grad-CAM
        extent = [0, img_size[1], img_size[0], 0]
        fig, ax = plt.subplots()
        im = ax.imshow(heat, cmap=CONVOLVE_CMAP, extent=extent, aspect="auto", vmin=0, vmax=np.percentile(heat, 99))
        ax.set_title(f"Grad-CAM Raw Data – {last_conv}")
        cbar = fig.colorbar(im, ax=ax)
        cbar.set_label("Importance")
        ax.axis("off")
        save_fig(fig, "gradcam_raw.png")

        # Create overlays
        heat_nn = tf.image.resize(heat[..., np.newaxis], img_size, method="nearest").numpy().squeeze()
        heat_u8 = np.uint8(255 * heat_nn)
        heatmap = cv2.applyColorMap(heat_u8, cv2.COLORMAP_JET)

        # Mask white background if threshold provided
        white_thresh = config.get('white_mask_thresh', 0.96)
        if white_thresh is not None:
            mask_bg = (img_arr[0] > white_thresh).all(axis=-1)
            heatmap[mask_bg] = (0, 0, 0)

        base_rgb = np.uint8(img_arr[0] * 255)
        base_bgr = cv2.cvtColor(base_rgb, cv2.COLOR_RGB2BGR)

        # Overlay with chart
        overlay = cv2.addWeighted(base_bgr, 0.6, heatmap, 0.4, 0)

        # Overlay with neutral background
        white_bg = np.ones_like(base_bgr) * 255
        overlay_white = cv2.addWeighted(white_bg, 0.6, heatmap, 0.4, 0)

        fig, ax = plt.subplots(1, 2, figsize=(11, 5))
        ax[0].imshow(cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB))
        ax[0].set_title("Grad-CAM Overlay with Chart")
        ax[1].imshow(cv2.cvtColor(overlay_white, cv2.COLOR_BGR2RGB))
        ax[1].set_title("Grad-CAM Overlay Neutral")
        for a in ax: a.axis("off")

        fig.subplots_adjust(right=0.85)
        cbar_ax = fig.add_axes([0.9, 0.15, 0.02, 0.7])
        norm = plt.Normalize(vmin=0, vmax=1)
        plt.colorbar(plt.cm.ScalarMappable(norm=norm, cmap="jet"), cax=cbar_ax, label="Importance")
        save_fig(fig, "gradcam_overlay.png")

        # 4) Saliency Map
        progress_cb("analyzing", 90, {"message": "Generating saliency map..."})
        inp_tensor = tf.convert_to_tensor(img_arr, dtype=tf.float32)
        with tf.GradientTape() as tape:
            tape.watch(inp_tensor)
            out = model(inp_tensor)
            loss = tf.reduce_sum(out)
        grads_in = tape.gradient(loss, inp_tensor)
        sal = tf.reduce_max(tf.abs(grads_in[0]), axis=-1).numpy()
        if sal.max() > 0: sal = sal / (sal.max() + 1e-8)
        sal = np.power(sal, 0.5)

        fig, ax = plt.subplots(1, 2, figsize=(11, 5))
        ax[0].imshow(img_arr[0])
        ax[0].set_title("Original")
        im = ax[1].imshow(sal, cmap=CONVOLVE_CMAP, vmin=0, vmax=np.percentile(sal, 99))
        ax[1].set_title("Saliency Map")
        for a in ax: a.axis("off")
        fig.colorbar(im, ax=ax[1], fraction=0.046, pad=0.04, label="Sensitivity")
        save_fig(fig, "saliency.png")

        # Create ZIP file
        progress_cb("packaging", 95, {"message": "Creating analysis ZIP file..."})
        import zipfile

        zip_path = run_dir_path / "cnn_analysis.zip"
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file_name in os.listdir(out_dir):
                if file_name.endswith('.png'):
                    file_path = out_dir / file_name
                    zip_file.write(file_path, file_name)

        # Save analysis summary
        analysis_summary = {
            "model_path": model_path,
            "img_path": img_path,
            "img_size": img_size,
            "output_dir": str(out_dir),
            "generated_files": [f for f in os.listdir(out_dir) if f.endswith('.png')],
            "completed_at": time.time()
        }

        with open(run_dir_path / "analysis_summary.json", 'w') as f:
            json.dump(analysis_summary, f, indent=2)

        progress_cb("done", 100, {
            "message": "CNN analysis completed successfully!",
            "analysis_files": analysis_summary["generated_files"],
            "zip_path": str(zip_path)
        })

    except Exception as e:
        error_msg = f"CNN analysis failed: {str(e)}"
        print(f"❌ {error_msg}")
        progress_cb("error", 0, {
            "message": error_msg,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise
