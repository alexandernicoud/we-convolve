import os
import numpy as np
import tensorflow as tf
from PIL import Image
from pathlib import Path
from typing import Callable, Dict, Any
import json
import time


def run_trainer(config: Dict[str, Any], run_dir: Path, progress_cb: Callable):
    """Run CNN training with provided configuration"""

    # Extract config
    use_standard = config.get('use_standard_config', True)
    if use_standard:
        IMG_SIZE = (224, 224)
        BATCH_SIZE = 16
        EPOCHS = 30
        VAL_SPLIT = 0.2
        RANDOM_SEED = 7
    else:
        IMG_SIZE = (config['image_height'], config['image_width'])
        BATCH_SIZE = config['batch_size']
        EPOCHS = config['epochs']
        VAL_SPLIT = config['val_split']
        RANDOM_SEED = config.get('random_seed', 7)

    folder_name = config['folder_name']
    model_name = config['model_name']

    # Setup paths
    model_path = run_dir / model_name
    metrics_file = run_dir / "metrics.jsonl"
    summary_file = run_dir / "summary.json"
    history_file = run_dir / "history.json"

    progress_cb("starting", 0, {"message": "Initializing training..."})

    try:
        def load_data():
            X, y = [], []
            total_files = 0
            print(f"Scanning folder: {folder_name}")

            if not os.path.exists(folder_name):
                raise FileNotFoundError(f"Folder {folder_name} does not exist")

            for file in os.listdir(folder_name):
                if file.endswith('.png') and 'label' in file:
                    total_files += 1
                    label = int(file.split('label')[1][0])
                    img_path = os.path.join(folder_name, file)
                    img = Image.open(img_path).convert('RGB').resize(IMG_SIZE)
                    X.append(np.array(img) / 255.0)
                    y.append(label)

            if len(X) == 0:
                raise ValueError(f"No labeled PNG images found in {folder_name}")

            print(f"✅ Loaded {len(X)} / {total_files} total images.")
            return np.array(X), np.array(y)

        # Load and split data
        progress_cb("loading", 5, {"message": "Loading and preprocessing images..."})
        X, y = load_data()

        # Shuffle data
        np.random.seed(RANDOM_SEED)
        indices = np.arange(len(X))
        np.random.shuffle(indices)
        X, y = X[indices], y[indices]

        # Split train/val
        split_index = int(len(X) * (1 - VAL_SPLIT))
        X_train, X_val = X[:split_index], X[split_index:]
        y_train, y_val = y[:split_index], y[split_index:]

        train_samples = len(X_train)
        val_samples = len(X_val)

        print(f"Training samples: {train_samples}")
        print(f"Validation samples: {val_samples}")

        progress_cb("loading", 15, {
            "message": f"Data loaded: {train_samples} train, {val_samples} validation samples"
        })

        # Build model
        progress_cb("building", 20, {"message": "Building CNN model..."})
        model = tf.keras.Sequential([
            tf.keras.layers.Input(shape=(*IMG_SIZE, 3)),
            tf.keras.layers.Conv2D(32, (3, 3), activation='relu'),
            tf.keras.layers.MaxPooling2D(2, 2),
            tf.keras.layers.Conv2D(64, (3, 3), activation='relu'),
            tf.keras.layers.MaxPooling2D(2, 2),
            tf.keras.layers.Conv2D(128, (3, 3), activation='relu'),
            tf.keras.layers.MaxPooling2D(2, 2),
            tf.keras.layers.Flatten(),
            tf.keras.layers.Dense(128, activation='relu'),
            tf.keras.layers.Dense(1, activation='sigmoid')
        ])

        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy']
        )

        # Setup callbacks
        early_stop = tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=5,
            restore_best_weights=True
        )

        # Custom callback for progress tracking
        class ProgressCallback(tf.keras.callbacks.Callback):
            def __init__(self, progress_cb, metrics_file):
                super().__init__()
                self.progress_cb = progress_cb
                self.metrics_file = metrics_file
                self.history_data = []

            def on_train_begin(self, logs=None):
                self.progress_cb("training", 25, {"message": "Starting training..."})

            def on_epoch_end(self, epoch, logs=None):
                if logs:
                    # Save metrics to file
                    epoch_data = {
                        "epoch": epoch + 1,
                        "epochs": self.params['epochs'],
                        "loss": float(logs.get('loss', 0)),
                        "accuracy": float(logs.get('accuracy', 0)),
                        "val_loss": float(logs.get('val_loss', 0)),
                        "val_accuracy": float(logs.get('val_accuracy', 0)),
                        "timestamp": time.time()
                    }

                    with open(self.metrics_file, 'a') as f:
                        f.write(json.dumps(epoch_data) + '\n')

                    self.history_data.append(epoch_data)

                    # Calculate progress percentage
                    progress_pct = 25 + int((epoch + 1) / self.params['epochs'] * 70)

                    self.progress_cb("training", progress_pct, {
                        "message": f"Epoch {epoch + 1}/{self.params['epochs']}",
                        "epoch": epoch + 1,
                        "epochs": self.params['epochs'],
                        "loss": epoch_data["loss"],
                        "accuracy": epoch_data["accuracy"],
                        "val_loss": epoch_data["val_loss"],
                        "val_accuracy": epoch_data["val_accuracy"]
                    })

            def on_train_end(self, logs=None):
                self.progress_cb("saving", 95, {"message": "Training completed, saving model..."})

                # Save full history
                with open(history_file, 'w') as f:
                    json.dump(self.history_data, f, indent=2)

        progress_callback = ProgressCallback(progress_cb, metrics_file)

        # Train the model
        model.fit(
            X_train, y_train,
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            validation_data=(X_val, y_val),
            callbacks=[early_stop, progress_callback],
            verbose=0  # Silent training
        )

        # Save model
        model.save(str(model_path))
        print(f"✅ Model saved as {model_path}")

        # Save summary
        summary_data = {
            "model_name": model_name,
            "config": config,
            "train_samples": train_samples,
            "val_samples": val_samples,
            "image_size": IMG_SIZE,
            "batch_size": BATCH_SIZE,
            "epochs_trained": len(progress_callback.history_data),
            "best_epoch": len(progress_callback.history_data) - 5 if len(progress_callback.history_data) > 5 else len(progress_callback.history_data),
            "final_metrics": progress_callback.history_data[-1] if progress_callback.history_data else None,
            "completed_at": time.time()
        }

        with open(summary_file, 'w') as f:
            json.dump(summary_data, f, indent=2)

        progress_cb("done", 100, {
            "message": "Training completed successfully!",
            "model_path": str(model_path),
            "summary": summary_data
        })

    except Exception as e:
        error_msg = f"Training failed: {str(e)}"
        print(f"❌ {error_msg}")
        progress_cb("error", 0, {
            "message": error_msg,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise
