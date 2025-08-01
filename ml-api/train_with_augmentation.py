import os
import shutil
import json
from ultralytics import YOLO
from sklearn.model_selection import ParameterGrid
import torch
import yaml

# Paths
DATA_YAML_PATH = 'datasets/data_combined.yaml'
INITIAL_WEIGHTS = 'yolov8s.pt'  # Switch to small model for better accuracy
OUTPUT_DIR = 'models/grid_search'

# Create output directory
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Check GPU availability
if torch.cuda.is_available():
    print(f"GPU detected: {torch.cuda.get_device_name()}")
    device = 'cuda'
else:
    print("No GPU detected, using CPU")
    device = 'cpu'

# Hyperparameter grid
param_grid = {
    'lr0': [0.01, 0.001],          # Learning rates
    'epochs': [100, 150],           # Number of epochs
    'batch_size': [16, 32],         # Batch sizes
    'imgsz': [640],                 # Image sizes
    'optimizer': ['AdamW', 'SGD'],  # Optimizers
}

best_map50 = 0
best_params = None
best_model_path = None
results_log = []

print(f"Starting hyperparameter search with {len(list(ParameterGrid(param_grid)))} combinations...")

# Iterate over all combinations of hyperparameters
for i, params in enumerate(ParameterGrid(param_grid)):
    print(f"\n=== Training run {i+1}/{len(list(ParameterGrid(param_grid)))} ===")
    print(f"Parameters: {params}")
    
    # Create unique run name
    run_name = f"run_{i+1}_lr{params['lr0']}_e{params['epochs']}_b{params['batch_size']}_opt{params['optimizer']}"
    
    try:
        # Initialize new model for each run
        model = YOLO(INITIAL_WEIGHTS)
        
        # Train the model with augmentation
        results = model.train(
            data=DATA_YAML_PATH,
            imgsz=params['imgsz'],
            epochs=params['epochs'],
            batch=params['batch_size'],
            lr0=params['lr0'],
            optimizer=params['optimizer'],
            device=device,
            # Data augmentation parameters
            flipud=0.5,      # Vertical flip probability
            fliplr=0.5,      # Horizontal flip probability
            degrees=15,      # Rotation degrees
            scale=0.5,       # Scaling factor
            shear=2.0,       # Shear degrees
            perspective=0.0001,  # Perspective transform
            hsv_h=0.015,     # Hue augmentation
            hsv_s=0.7,       # Saturation augmentation
            hsv_v=0.4,       # Value augmentation
            translate=0.1,   # Translation fraction
            mosaic=1.0,      # Mosaic probability
            mixup=0.0,       # Mixup probability
            copy_paste=0.0,  # Copy-paste probability
            # Training parameters
            patience=50,     # Early stopping patience
            save_period=10,  # Save checkpoint every N epochs
            project=OUTPUT_DIR,
            name=run_name,
            exist_ok=True,
            verbose=True,
            plots=True,
            val=True,
            save=True,
            save_txt=True,
            save_conf=True,
            # Class weights to handle imbalance
            cls=0.5,         # Classification loss weight
            box=7.5,         # Box loss weight
            dfl=1.5,         # DFL loss weight
        )
        
        # Extract validation metrics
        val_map50 = results.results_dict.get('metrics/mAP50(B)', 0)
        val_map50_95 = results.results_dict.get('metrics/mAP50-95(B)', 0)
        val_precision = results.results_dict.get('metrics/precision(B)', 0)
        val_recall = results.results_dict.get('metrics/recall(B)', 0)
        
        print(f"\nValidation Results:")
        print(f"mAP50: {val_map50:.4f}")
        print(f"mAP50-95: {val_map50_95:.4f}")
        print(f"Precision: {val_precision:.4f}")
        print(f"Recall: {val_recall:.4f}")
        
        # Log results
        result_entry = {
            'run': i+1,
            'params': params,
            'map50': val_map50,
            'map50_95': val_map50_95,
            'precision': val_precision,
            'recall': val_recall,
            'model_path': os.path.join(OUTPUT_DIR, run_name, 'weights', 'best.pt')
        }
        results_log.append(result_entry)
        
        # Check if this is the best model (using mAP50 as primary metric)
        if val_map50 > best_map50:
            best_map50 = val_map50
            best_params = params
            best_model_path = os.path.join(OUTPUT_DIR, run_name, 'weights', 'best.pt')
            print(f"\n*** NEW BEST MODEL! mAP50: {best_map50:.4f} ***")
        
        # Check if target accuracy is achieved
        if val_precision > 0.8:
            print(f"\n*** TARGET ACCURACY ACHIEVED! Precision: {val_precision:.4f} ***")
            
    except Exception as e:
        print(f"Error in training run {i+1}: {str(e)}")
        continue

# Save results log
results_file = os.path.join(OUTPUT_DIR, 'hyperparameter_search_results.json')
with open(results_file, 'w') as f:
    json.dump(results_log, f, indent=2)

print(f"\n=== HYPERPARAMETER SEARCH COMPLETE ===")
print(f"Best mAP50 achieved: {best_map50:.4f}")
print(f"Best parameters: {best_params}")
print(f"Results saved to: {results_file}")

# Copy the best model to the main models directory
if best_model_path and os.path.exists(best_model_path):
    target_model_path = os.path.join('models', 'hazard_detection_optimized.pt')
    shutil.copy2(best_model_path, target_model_path)
    print(f"\nBest model copied to: {target_model_path}")
    
    # Also update the main model file
    main_model_path = os.path.join('models', 'hazard_detection.pt')
    shutil.copy2(best_model_path, main_model_path)
    print(f"Main model updated: {main_model_path}")
    
    # Save best parameters
    best_params_file = os.path.join('models', 'best_hyperparameters.json')
    with open(best_params_file, 'w') as f:
        json.dump({
            'best_params': best_params,
            'best_map50': best_map50,
            'model_path': target_model_path
        }, f, indent=2)
    print(f"Best parameters saved to: {best_params_file}")
else:
    print("\nNo valid model found from hyperparameter search!")

# Print summary of all runs
print("\n=== SUMMARY OF ALL RUNS ===")
for result in sorted(results_log, key=lambda x: x['map50'], reverse=True):
    print(f"Run {result['run']}: mAP50={result['map50']:.4f}, Precision={result['precision']:.4f}, Params={result['params']}")
