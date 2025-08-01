import os
from ultralytics import YOLO

# Paths to dataset and model
DATA_YAML_PATH = 'datasets/data.yaml'
INITIAL_WEIGHTS = 'yolov8n.pt'  # Path to initial weights
OUTPUT_DIR = 'models'  # Directory to save new model weights

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Initialize YOLO model with pre-trained weights
model = YOLO(INITIAL_WEIGHTS)

# Train the model using the dataset
results = model.train(
    data=DATA_YAML_PATH,
    imgsz=640,  # change this value based on your resources and requirements
    epochs=50,  # number of training epochs
    batch=16,  # adjust based on your GPU/CPU capabilities
    name='custom_yolov8',  # name of the run
    project=OUTPUT_DIR,  # directory where training outputs will be saved
    exist_ok=True  # overwrite if file exists
)

# After training, copy the best model to the expected location
import shutil
best_model_path = os.path.join(OUTPUT_DIR, 'custom_yolov8', 'weights', 'best.pt')
target_model_path = os.path.join(OUTPUT_DIR, 'hazard_detection.pt')

if os.path.exists(best_model_path):
    shutil.copy2(best_model_path, target_model_path)
    print(f"Model saved to {target_model_path}")
else:
    print("Training completed but best model not found at expected location")
