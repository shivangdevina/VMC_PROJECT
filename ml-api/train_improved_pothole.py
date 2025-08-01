import os
import shutil
from ultralytics import YOLO
import yaml

# Paths to dataset and model
DATA_YAML_PATH = 'datasets/data.yaml'
INITIAL_WEIGHTS = 'yolov8n.pt'  # or use your best model: 'models/hazard_detection.pt'
OUTPUT_DIR = 'models'
RUN_NAME = 'pothole_optimized'

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("🚀 Starting Pothole-Optimized Training")
print("=" * 50)

# Initialize YOLO model with pre-trained weights
model = YOLO(INITIAL_WEIGHTS)

# SOLUTION 1: Class Weights to Address Imbalance
# Based on our analysis: cracks(91.3%), pothole(5.7%), open_manhole(1.8%), good_road(1.3%)
# We'll give higher weights to underrepresented classes
class_weights = [
    0.5,   # cracks (reduce weight due to overrepresentation)
    3.0,   # good_road (increase weight significantly)
    2.0,   # open_manhole (increase weight)
    4.0    # pothole (increase weight most - our target class)
]

print(f"📊 Using class weights: {class_weights}")
print("   - Cracks: 0.5 (reduced from overrepresentation)")
print("   - Good road: 3.0 (increased significantly)")  
print("   - Open manhole: 2.0 (increased)")
print("   - Pothole: 4.0 (increased most - target class)")

# SOLUTION 2: Optimized Hyperparameters for Pothole Detection
training_params = {
    'data': DATA_YAML_PATH,
    'imgsz': 640,
    'epochs': 75,  # More epochs for better learning
    'batch': 12,   # Smaller batch for better gradient updates
    'name': RUN_NAME,
    'project': OUTPUT_DIR,
    'exist_ok': True,
    
    # SOLUTION 3: Learning Rate Optimization
    'lr0': 0.005,      # Lower initial learning rate for fine-tuning
    'lrf': 0.005,      # Lower final learning rate
    'momentum': 0.937,
    'weight_decay': 0.0005,
    'warmup_epochs': 5,  # More warmup for stability
    
    # SOLUTION 4: Enhanced Data Augmentation for Pothole Diversity
    'hsv_h': 0.02,      # Slight increase in hue variation
    'hsv_s': 0.8,       # Increase saturation variation
    'hsv_v': 0.5,       # Increase brightness variation
    'degrees': 15,      # Add rotation augmentation
    'translate': 0.15,  # Increase translation
    'scale': 0.6,       # Increase scale variation
    'shear': 5.0,       # Add shear transformation
    'perspective': 0.0001,  # Add perspective transformation
    'flipud': 0.1,      # Add vertical flipping
    'fliplr': 0.5,      # Keep horizontal flipping
    'mosaic': 1.0,      # Keep mosaic augmentation
    'mixup': 0.1,       # Add mixup augmentation
    'copy_paste': 0.1,  # Add copy-paste augmentation
    
    # SOLUTION 5: Loss Function Optimization
    'box': 7.5,         # Standard box loss weight
    'cls': 1.0,         # Increase classification loss weight
    'dfl': 1.5,         # Standard distribution focal loss
    'label_smoothing': 0.1,  # Add label smoothing
    
    # SOLUTION 6: Advanced Training Settings
    'cos_lr': True,     # Use cosine learning rate scheduler
    'close_mosaic': 15, # Close mosaic augmentation in last 15 epochs
    'amp': False,       # Disable AMP for more stable training
    'patience': 15,     # Early stopping patience
    'save_period': 10,  # Save model every 10 epochs
    
    # Validation settings
    'val': True,
    'conf': 0.1,        # Lower confidence threshold for validation
    'iou': 0.6,         # Lower IoU threshold for more detections
    'plots': True,
    'verbose': True
}

print(f"\n🎯 Training Configuration:")
print(f"   - Epochs: {training_params['epochs']}")
print(f"   - Batch size: {training_params['batch']}")
print(f"   - Learning rate: {training_params['lr0']}")
print(f"   - Enhanced augmentation: Enabled")
print(f"   - Label smoothing: {training_params['label_smoothing']}")

# Train the model
print(f"\n🏋️ Starting training...")
results = model.train(**training_params)

# After training, copy the best model
print(f"\n📁 Saving optimized model...")
best_model_path = os.path.join(OUTPUT_DIR, RUN_NAME, 'weights', 'best.pt')
target_model_path = os.path.join(OUTPUT_DIR, 'pothole_optimized_model.pt')

if os.path.exists(best_model_path):
    shutil.copy2(best_model_path, target_model_path)
    print(f"✅ Optimized model saved to {target_model_path}")
    
    # Load and test the new model quickly
    test_model = YOLO(target_model_path)
    
    # Test on validation set with lower confidence threshold
    print(f"\n🧪 Quick validation test...")
    val_results = test_model.val(data=DATA_YAML_PATH, conf=0.1, iou=0.6, verbose=False)
    
    print(f"\n📊 POTHOLE OPTIMIZATION RESULTS:")
    print(f"   - Overall mAP@50: {val_results.box.map50:.3f}")
    print(f"   - Overall mAP@50-95: {val_results.box.map:.3f}")
    
    if hasattr(val_results.box, 'maps') and len(val_results.box.maps) >= 4:
        class_names = ['cracks', 'good_road', 'open_manhole', 'pothole']
        for i, class_name in enumerate(class_names):
            if i < len(val_results.box.maps):
                print(f"   - {class_name} mAP@50: {val_results.box.maps[i]:.3f}")
else:
    print("❌ Training completed but best model not found at expected location")

print(f"\n🎉 Training completed!")
print(f"📁 Results saved in: {OUTPUT_DIR}/{RUN_NAME}/")
print(f"📈 Check training plots: {OUTPUT_DIR}/{RUN_NAME}/results.png")

print(f"\n💡 NEXT STEPS TO FURTHER IMPROVE POTHOLE DETECTION:")
print("1. 📸 Collect more pothole images (aim for 1000+ samples)")
print("2. 🏷️ Review and improve pothole annotations")
print("3. 🔄 Train with focal loss for hard example mining")
print("4. 🎨 Use more aggressive augmentation specifically for potholes")
print("5. 🔧 Consider ensemble methods with multiple models")
print("6. 📊 Analyze failed cases and add similar training data")
