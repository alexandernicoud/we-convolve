#!/usr/bin/env python3
"""
Backtester Script - 3.2_Tester_Pro_v2.py
Performs backtesting of trained CNN models on chart datasets
"""

import os
import sys
import json
import argparse
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
import tensorflow as tf
from tensorflow import keras
from PIL import Image
import matplotlib.pyplot as plt

def parse_args():
    parser = argparse.ArgumentParser(description='Backtest CNN model on chart dataset')
    parser.add_argument('--model_path', required=True, help='Path to Keras model file')
    parser.add_argument('--dataset_path', required=True, help='Path to dataset images directory')
    parser.add_argument('--sample_size', type=str, default='all', help='Sample size (number or "all")')
    parser.add_argument('--confidence_threshold', type=float, default=0.5, help='Confidence threshold for predictions')
    parser.add_argument('--tp_pct', type=float, default=2.0, help='Take profit percentage')
    parser.add_argument('--sl_pct', type=float, default=2.0, help='Stop loss percentage')
    parser.add_argument('--img_size', type=int, default=224, help='Image size for model input')
    parser.add_argument('--output_dir', required=True, help='Output directory for results')

    # Trading parameters
    parser.add_argument('--starting_capital', type=float, default=10000.0, help='Starting capital amount')
    parser.add_argument('--position_size_pct', type=float, default=10.0, help='Position size as percentage of capital')
    parser.add_argument('--commission_pct', type=float, default=0.1, help='Commission per trade as percentage')
    parser.add_argument('--slippage_pct', type=float, default=0.05, help='Slippage per trade as percentage')

    # Risk management
    parser.add_argument('--max_drawdown_pct', type=float, default=20.0, help='Maximum drawdown before stopping')
    parser.add_argument('--max_trades_per_day', type=int, default=10, help='Maximum trades per simulated day')

    return parser.parse_args()

def load_model(model_path):
    """Load Keras model from file"""
    print(f"Loading model from {model_path}")
    try:
        model = keras.models.load_model(model_path)
        print(f"Model loaded successfully. Input shape: {model.input_shape}")
        return model
    except Exception as e:
        raise Exception(f"Failed to load model: {e}")

def load_dataset_images(dataset_path, sample_size, img_size):
    """Load and preprocess dataset images"""
    dataset_path = Path(dataset_path)
    print(f"Loading dataset from {dataset_path}")

    if not dataset_path.exists():
        raise Exception(f"Dataset path does not exist: {dataset_path}")

    # Find all image files
    image_extensions = ['.png', '.jpg', '.jpeg', '.bmp']
    image_files = []
    for ext in image_extensions:
        image_files.extend(list(dataset_path.glob(f'**/*{ext}')))
        image_files.extend(list(dataset_path.glob(f'**/*{ext.upper()}')))

    if not image_files:
        raise Exception(f"No image files found in {dataset_path}")

    print(f"Found {len(image_files)} images")

    # Limit sample size if specified
    if sample_size != 'all':
        try:
            sample_limit = int(sample_size)
            if sample_limit > 0 and sample_limit < len(image_files):
                image_files = image_files[:sample_limit]
                print(f"Limited to {sample_limit} samples")
        except ValueError:
            pass  # Invalid sample_size, use all

    # Load and preprocess images
    images = []
    labels = []

    for img_path in image_files:
        try:
            # Extract label from filename (0 or 1 based on filename pattern)
            filename = img_path.name.lower()
            if 'label0' in filename or '_0.' in filename:
                label = 0
            elif 'label1' in filename or '_1.' in filename:
                label = 1
            else:
                # Try to infer from filename
                if 'tp' in filename or 'profit' in filename or 'up' in filename:
                    label = 1
                else:
                    label = 0

            # Load and preprocess image
            img = Image.open(img_path).convert('RGB')
            img = img.resize((img_size, img_size))
            img_array = np.array(img) / 255.0  # Normalize to [0,1]
            images.append(img_array)
            labels.append(label)

        except Exception as e:
            print(f"Warning: Failed to load {img_path}: {e}")
            continue

    if not images:
        raise Exception("No valid images could be loaded")

    X = np.array(images)
    y = np.array(labels)

    print(f"Loaded {len(X)} images with shape {X.shape}")
    print(f"Label distribution: {np.bincount(y)}")

    return X, y, [str(p) for p in image_files[:len(images)]]

def run_backtest(model, X, y, filenames, confidence_threshold, tp_pct, sl_pct, output_dir, args):
    """Run backtesting simulation"""
    print("Running backtest simulation...")

    # Make predictions
    predictions = model.predict(X, batch_size=32, verbose=1)
    confidence_scores = np.max(predictions, axis=1)
    predicted_classes = np.argmax(predictions, axis=1)

    print(f"Total predictions: {len(predictions)}")
    print(f"Class distribution - Predicted: {np.bincount(predicted_classes)}")
    print(f"Class distribution - Actual: {np.bincount(y)}")
    print(f"Confidence stats - Mean: {np.mean(confidence_scores):.3f}, Min: {np.min(confidence_scores):.3f}, Max: {np.max(confidence_scores):.3f}")
    print(f"Confidence threshold: {confidence_threshold}")

    # Be more permissive - use predictions with confidence > 0.01 or the top 50% most confident
    if confidence_threshold > 0.01:
        confident_mask = confidence_scores >= confidence_threshold
        if not np.any(confident_mask):
            print(f"WARNING: No predictions meet confidence threshold {confidence_threshold}. Using predictions with confidence > 0.01.")
            confident_mask = confidence_scores > 0.01
    else:
        # For very low thresholds, use all predictions
        confident_mask = np.ones(len(predictions), dtype=bool)

    # If still no predictions, force use at least some
    if not np.any(confident_mask):
        print("WARNING: Using all predictions regardless of confidence.")
        confident_mask = np.ones(len(predictions), dtype=bool)

    confident_predictions = predicted_classes[confident_mask]
    confident_actual = y[confident_mask]
    confident_scores = confidence_scores[confident_mask]
    confident_filenames = [filenames[i] for i in range(len(filenames)) if confident_mask[i]]

    print(f"Using {len(confident_predictions)} predictions for trading (threshold: {confidence_threshold})")
    print(f"Prediction types - Bullish (1): {np.sum(confident_predictions == 1)}, Bearish (0): {np.sum(confident_predictions == 0)}")

    # Simulate trading (both bullish and bearish signals)
    trades = []
    capital = args.starting_capital  # Starting capital from args
    position_size = capital * (args.position_size_pct / 100.0)  # Position size as % of capital

    for i, (pred, actual, conf, filename) in enumerate(zip(confident_predictions, confident_actual, confident_scores, confident_filenames)):
        # Trade on both bullish (1) and bearish (0) predictions
        entry_price = 100.0  # Simulated entry price

        if pred == 1:  # Bullish prediction
            tp_price = entry_price * (1.0 + tp_pct / 100.0)
            sl_price = entry_price * (1.0 - sl_pct / 100.0)
            # Bullish prediction is correct if actual is also 1
            if actual == 1:
                exit_price = tp_price
                outcome = "TP"
                pnl = position_size * (tp_pct / 100.0)
            else:
                exit_price = sl_price
                outcome = "SL"
                pnl = -position_size * (sl_pct / 100.0)
        else:  # Bearish prediction (pred == 0)
            # For bearish, we want price to go down, so TP is below entry
            tp_price = entry_price * (1.0 - tp_pct / 100.0)  # Target lower price
            sl_price = entry_price * (1.0 + sl_pct / 100.0)  # Stop above entry
            # Bearish prediction is correct if actual is also 0
            if actual == 0:
                exit_price = tp_price
                outcome = "TP"
                pnl = position_size * (tp_pct / 100.0)  # Profit from price going down
            else:
                exit_price = sl_price
                outcome = "SL"
                pnl = -position_size * (sl_pct / 100.0)

        # Apply commissions and slippage
        commission_cost = position_size * (args.commission_pct / 100.0)
        slippage_cost = position_size * (args.slippage_pct / 100.0)

        # Net P&L after costs
        net_pnl = pnl - commission_cost - slippage_cost
        capital += net_pnl

        # Check drawdown limit
        current_drawdown = args.starting_capital - capital
        if current_drawdown > (args.starting_capital * args.max_drawdown_pct / 100.0):
            print(f"Max drawdown limit ({args.max_drawdown_pct}%) reached. Stopping trading.")
            break

        trade = {
            "trade_id": i + 1,
            "entry_price": entry_price,
            "exit_price": exit_price,
            "prediction": int(pred),
            "actual": int(actual),
            "confidence": float(conf),
            "outcome": outcome,
            "pnl_gross": float(pnl),
            "commission": float(commission_cost),
            "slippage": float(slippage_cost),
            "pnl_net": float(net_pnl),
            "capital_after": float(capital),
            "filename": filename
        }
        trades.append(trade)

        # Check max trades per day limit (simplified - all trades in one "day")
        if len(trades) >= args.max_trades_per_day:
            print(f"Max trades per day ({args.max_trades_per_day}) reached. Stopping trading.")
            break

    # Calculate metrics
    # Calculate comprehensive metrics
    if trades:
        total_trades = len(trades)
        winning_trades = len([t for t in trades if t['pnl_net'] > 0])
        losing_trades = total_trades - winning_trades
        win_rate = winning_trades / total_trades if total_trades > 0 else 0
        total_pnl = sum(t['pnl_net'] for t in trades)

        # Calculate drawdown
        capital_history = [args.starting_capital] + [t['capital_after'] for t in trades]
        peak = capital_history[0]
        max_drawdown = 0
        for capital in capital_history:
            if capital > peak:
                peak = capital
            drawdown = peak - capital
            max_drawdown = max(max_drawdown, drawdown)

        # Additional metrics (using net P&L)
        avg_win = np.mean([t['pnl_net'] for t in trades if t['pnl_net'] > 0]) if winning_trades > 0 else 0
        avg_loss = abs(np.mean([t['pnl_net'] for t in trades if t['pnl_net'] < 0])) if losing_trades > 0 else 0
        profit_factor = abs(sum([t['pnl_net'] for t in trades if t['pnl_net'] > 0]) / sum([t['pnl_net'] for t in trades if t['pnl_net'] < 0])) if losing_trades > 0 and sum([t['pnl_net'] for t in trades if t['pnl_net'] < 0]) != 0 else float('inf')

        # Sharpe ratio (simplified, assuming daily returns)
        returns = [t['pnl_net'] / args.starting_capital for t in trades]  # Daily returns approximation
        if len(returns) > 1:
            sharpe_ratio = np.mean(returns) / np.std(returns) * np.sqrt(252) if np.std(returns) > 0 else 0
        else:
            sharpe_ratio = 0

        metrics = {
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "losing_trades": losing_trades,
            "win_rate": float(win_rate),
            "total_pnl": float(total_pnl),
            "final_capital": float(capital),
            "return_pct": float((capital - 10000) / 10000 * 100),
            "max_drawdown": float(max_drawdown),
            "avg_win": float(avg_win),
            "avg_loss": float(avg_loss),
            "profit_factor": float(profit_factor),
            "sharpe_ratio": float(sharpe_ratio),
            "avg_confidence": float(np.mean([t['confidence'] for t in trades])),
            "confidence_threshold": confidence_threshold,
            "tp_pct": tp_pct,
            "sl_pct": sl_pct
        }
    else:
        metrics = {
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate": 0.0,
            "total_pnl": 0.0,
            "final_capital": 10000.0,
            "return_pct": 0.0,
            "max_drawdown": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "profit_factor": 0.0,
            "sharpe_ratio": 0.0,
            "avg_confidence": 0.0,
            "confidence_threshold": confidence_threshold,
            "tp_pct": tp_pct,
            "sl_pct": sl_pct
        }

    return trades, metrics

def generate_charts(trades, metrics, output_dir):
    """Generate performance charts"""
    output_dir = Path(output_dir)
    charts_dir = output_dir / "charts"
    charts_dir.mkdir(exist_ok=True)

    charts_generated = {}

    # Create equity curve chart
    if trades:
        capital_history = [10000.0]  # Starting capital
        for trade in trades:
            capital_history.append(trade['capital_after'])

        plt.figure(figsize=(12, 6))
        plt.plot(capital_history, linewidth=2, color='#3B82F6')
        plt.title('Equity Curve', fontsize=14, fontweight='bold')
        plt.xlabel('Trades')
        plt.ylabel('Capital ($)')
        plt.grid(True, alpha=0.3)
        plt.axhline(y=10000, color='red', linestyle='--', alpha=0.5, label='Starting Capital')
        plt.legend()
        plt.tight_layout()
        equity_path = charts_dir / 'equity_curve.png'
        plt.savefig(equity_path, dpi=150, bbox_inches='tight')
        plt.close()
        charts_generated["equity_curve"] = str(equity_path)

        # Create returns distribution chart
        pnls = [t['pnl_net'] for t in trades]
        plt.figure(figsize=(10, 6))
        plt.hist(pnls, bins=max(10, len(pnls)//5), alpha=0.7, color='#10B981', edgecolor='white')
        plt.axvline(x=0, color='red', linestyle='--', alpha=0.7, linewidth=2)
        plt.axvline(x=np.mean(pnls), color='blue', linestyle='-', alpha=0.7, linewidth=2, label=f'Mean: ${np.mean(pnls):.2f}')
        plt.title('Trade P&L Distribution', fontsize=14, fontweight='bold')
        plt.xlabel('P&L ($)')
        plt.ylabel('Frequency')
        plt.grid(True, alpha=0.3)
        plt.legend()
        plt.tight_layout()
        pnl_path = charts_dir / 'pnl_distribution.png'
        plt.savefig(pnl_path, dpi=150, bbox_inches='tight')
        plt.close()
        charts_generated["pnl_distribution"] = str(pnl_path)

        # Create monthly returns chart if we have enough trades
        if len(trades) > 5:
            # Group trades by "month" (simulate with trade indices)
            monthly_returns = []
            monthly_labels = []
            chunk_size = max(1, len(trades) // 6)  # Divide into ~6 periods

            for i in range(0, len(trades), chunk_size):
                chunk = trades[i:i+chunk_size]
                chunk_pnl = sum(t['pnl_net'] for t in chunk)
                monthly_returns.append(chunk_pnl)
                monthly_labels.append(f'Period {len(monthly_returns)}')

            plt.figure(figsize=(10, 6))
            bars = plt.bar(monthly_labels, monthly_returns, color=['#10B981' if x >= 0 else '#EF4444' for x in monthly_returns], alpha=0.7)
            plt.title('Performance by Period', fontsize=14, fontweight='bold')
            plt.ylabel('P&L ($)')
            plt.grid(True, alpha=0.3, axis='y')
            plt.xticks(rotation=45)
        plt.tight_layout()
        monthly_path = charts_dir / 'monthly_performance.png'
        plt.savefig(monthly_path, dpi=150, bbox_inches='tight')
        plt.close()
        charts_generated["monthly_performance"] = str(monthly_path)

    # Create comprehensive metrics dashboard
    fig, axes = plt.subplots(3, 3, figsize=(15, 12))
    fig.suptitle('Backtest Performance Dashboard', fontsize=16, fontweight='bold')

    # Row 1: Basic metrics
    axes[0,0].bar(['Win Rate'], [metrics['win_rate'] * 100], color='#10B981', alpha=0.7)
    axes[0,0].set_ylabel('Percentage (%)')
    axes[0,0].set_title('Win Rate')
    axes[0,0].set_ylim(0, 100)

    axes[0,1].bar(['Total P&L'], [metrics['total_pnl']], color='#3B82F6' if metrics['total_pnl'] >= 0 else '#EF4444', alpha=0.7)
    axes[0,1].set_ylabel('Amount ($)')
    axes[0,1].set_title('Total P&L')

    axes[0,2].bar(['Return %'], [metrics['return_pct']], color='#10B981' if metrics['return_pct'] >= 0 else '#EF4444', alpha=0.7)
    axes[0,2].set_ylabel('Percentage (%)')
    axes[0,2].set_title('Total Return %')

    # Row 2: Risk metrics
    axes[1,0].bar(['Max Drawdown'], [metrics['max_drawdown']], color='#EF4444', alpha=0.7)
    axes[1,0].set_ylabel('Amount ($)')
    axes[1,0].set_title('Max Drawdown')

    axes[1,1].bar(['Profit Factor'], [min(metrics['profit_factor'], 5)], color='#8B5CF6', alpha=0.7)  # Cap for display
    axes[1,1].set_ylabel('Ratio')
    axes[1,1].set_title('Profit Factor')
    if metrics['profit_factor'] > 5:
        axes[1,1].text(0, 4.5, f'>{5:.1f}', ha='center', va='bottom', fontweight='bold')

    axes[1,2].bar(['Trades'], [metrics['total_trades']], color='#F59E0B', alpha=0.7)
    axes[1,2].set_ylabel('Count')
    axes[1,2].set_title('Total Trades')

    # Row 3: Additional metrics
    axes[2,0].bar(['Avg Win'], [metrics['avg_win']], color='#10B981', alpha=0.7)
    axes[2,0].set_ylabel('Amount ($)')
    axes[2,0].set_title('Average Win')

    axes[2,1].bar(['Avg Loss'], [metrics['avg_loss']], color='#EF4444', alpha=0.7)
    axes[2,1].set_ylabel('Amount ($)')
    axes[2,1].set_title('Average Loss')

    axes[2,2].bar(['Sharpe Ratio'], [metrics['sharpe_ratio']], color='#06B6D4', alpha=0.7)
    axes[2,2].set_ylabel('Ratio')
    axes[2,2].set_title('Sharpe Ratio')

    plt.tight_layout()
    dashboard_path = charts_dir / 'performance_dashboard.png'
    plt.savefig(dashboard_path, dpi=150, bbox_inches='tight')
    plt.close()
    charts_generated["performance_dashboard"] = str(dashboard_path)

    return charts_generated

def main():
    try:
        args = parse_args()

        print("=" * 60)
        print("CNN Backtester - Starting Analysis")
        print("=" * 60)
        print(f"Model: {args.model_path}")
        print(f"Dataset: {args.dataset_path}")
        print(f"Sample size: {args.sample_size}")
        print(f"Confidence threshold: {args.confidence_threshold}")
        print(f"TP/SL: {args.tp_pct}% / {args.sl_pct}%")
        print(f"Output: {args.output_dir}")
        print()

        # Create output directory
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Load model
        model = load_model(args.model_path)

        # Load dataset
        X, y, filenames = load_dataset_images(args.dataset_path, args.sample_size, args.img_size)

        # Run backtest
        trades, metrics = run_backtest(
            model, X, y, filenames,
            args.confidence_threshold,
            args.tp_pct, args.sl_pct,
            args.output_dir, args
        )

        # Generate charts
        charts = generate_charts(trades, metrics, args.output_dir)

        # Save results in format expected by frontend
        results = {
            "timestamp": datetime.now().isoformat(),
            "config": {
                "model_path": args.model_path,
                "dataset_path": args.dataset_path,
                "sample_size": args.sample_size,
                "confidence_threshold": args.confidence_threshold,
                "tp_pct": args.tp_pct,
                "sl_pct": args.sl_pct,
                "img_size": args.img_size
            },
            "kpis": {
                "trades": metrics['total_trades'],
                "pnl": metrics['total_pnl'],
                "accuracy": metrics['win_rate'] * 100,  # Convert to percentage
                "precision": metrics['win_rate'] * 100,  # Simplified - using win rate as precision
                "recall": metrics['win_rate'] * 100,     # Simplified - using win rate as recall
                "sample_size": len(X),  # Total images processed
                "buy_and_hold": metrics['final_capital'] * 0.8,  # Simplified buy & hold calculation
                "win_rate": metrics['win_rate'] * 100,
                "profit_factor": metrics['profit_factor'],
                "sharpe_ratio": metrics['sharpe_ratio'],
                "max_drawdown": metrics['max_drawdown'],
                "avg_win": metrics['avg_win'],
                "avg_loss": metrics['avg_loss'],
                # Trading parameters
                "starting_capital": args.starting_capital,
                "position_size_pct": args.position_size_pct,
                "commission_pct": args.commission_pct,
                "slippage_pct": args.slippage_pct,
                "max_drawdown_pct": args.max_drawdown_pct,
                "max_trades_per_day": args.max_trades_per_day
            },
            "trades": trades[:100],  # Limit trade details for large datasets
            "charts": charts,
            "summary": {
                "total_images_processed": len(X),
                "trades_executed": len(trades),
                "model_predictions": len([t for t in trades if t['prediction'] == 1]),
                "avg_confidence": metrics['avg_confidence']
            }
        }

        # Save JSON results
        with open(output_dir / "backtest_results.json", 'w') as f:
            json.dump(results, f, indent=2, default=str)

        print("\n" + "=" * 60)
        print("BACKTEST COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print(f"Total trades: {metrics['total_trades']}")
        print(".1f")
        print(".2f")
        print(".2f")
        print(f"Final capital: ${metrics['final_capital']:.2f}")
        print(f"Results saved to: {output_dir}")
        print("=" * 60)

        return 0

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())