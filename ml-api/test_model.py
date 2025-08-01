import os
from ultralytics import YOLO
from PIL import Image

# Paths
MODEL_PATH = 'models/hazard_detection.pt'
IMAGES_DIR = 'datasets/val/images'
OUTPUT_DIR = 'datasets/val/predictions'

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load the model
model = YOLO(MODEL_PATH)

# Get list of images
images = [f for f in os.listdir(IMAGES_DIR) if f.endswith(('.jpg', '.jpeg', '.png'))]

# Process each image
for image_name in images:
    image_path = os.path.join(IMAGES_DIR, image_name)
    image = Image.open(image_path)

    # Run prediction
    results = model.predict(source=image_path, save=True, project=OUTPUT_DIR, name=image_name)

    # Display results
    for result in results:
        print(result)

