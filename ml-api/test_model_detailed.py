import os
import json
from ultralytics import YOLO
import matplotlib.pyplot as plt
import numpy as np
from collections import defaultdict

# Paths
MODEL_PATH = 'models/hazard_detection.pt'
IMAGES_DIR = 'datasets/val/images'
OUTPUT_DIR = 'test_results'

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load the model
print("Loading trained model...")
model = YOLO(MODEL_PATH)

# Class names
class_names = ['cracks', 'good_road', 'open_manhole', 'pothole']

# Run prediction on validation set
print("Running predictions on validation set...")
results = model.predict(source=IMAGES_DIR, save=True, project=OUTPUT_DIR, name='predictions', conf=0.25)

# Analyze results
detections_per_class = defaultdict(int)
confidence_scores = defaultdict(list)
total_detections = 0

print("\n=== DETAILED PREDICTION RESULTS ===")
for i, result in enumerate(results):
    image_name = f"val_{i:06d}.jpg"
    print(f"\nImage: {image_name}")
    
    if result.boxes is not None:
        boxes = result.boxes
        for j in range(len(boxes)):
            class_id = int(boxes.cls[j].item())
            confidence = boxes.conf[j].item()
            class_name = class_names[class_id]
            
            detections_per_class[class_name] += 1
            confidence_scores[class_name].append(confidence)
            total_detections += 1
            
            print(f"  - {class_name}: {confidence:.3f}")
    else:
        print("  - No detections")

print(f"\n=== SUMMARY STATISTICS ===")
print(f"Total detections: {total_detections}")
print(f"Images processed: {len(results)}")
print(f"Average detections per image: {total_detections/len(results):.2f}")

print(f"\n=== DETECTIONS BY CLASS ===")
for class_name in class_names:
    count = detections_per_class[class_name]
    if count > 0:
        avg_conf = np.mean(confidence_scores[class_name])
        print(f"{class_name}: {count} detections (avg confidence: {avg_conf:.3f})")
    else:
        print(f"{class_name}: 0 detections")

# Create visualization
plt.figure(figsize=(12, 8))

# Plot 1: Detections per class
plt.subplot(2, 2, 1)
classes = list(detections_per_class.keys())
counts = list(detections_per_class.values())
plt.bar(classes, counts, color=['red', 'green', 'blue', 'orange'])
plt.title('Detections per Class')
plt.xlabel('Class')
plt.ylabel('Number of Detections')
plt.xticks(rotation=45)

# Plot 2: Confidence distribution
plt.subplot(2, 2, 2)
all_confidences = []
for class_name in class_names:
    if confidence_scores[class_name]:
        all_confidences.extend(confidence_scores[class_name])

if all_confidences:
    plt.hist(all_confidences, bins=20, alpha=0.7, color='skyblue')
    plt.title('Confidence Score Distribution')
    plt.xlabel('Confidence Score')
    plt.ylabel('Frequency')

# Plot 3: Average confidence per class
plt.subplot(2, 2, 3)
avg_confidences = []
class_labels = []
for class_name in class_names:
    if confidence_scores[class_name]:
        avg_confidences.append(np.mean(confidence_scores[class_name]))
        class_labels.append(class_name)

if avg_confidences:
    plt.bar(class_labels, avg_confidences, color=['red', 'green', 'blue', 'orange'])
    plt.title('Average Confidence per Class')
    plt.xlabel('Class')
    plt.ylabel('Average Confidence')
    plt.xticks(rotation=45)

# Plot 4: Detection percentage
plt.subplot(2, 2, 4)
detection_percentages = []
for class_name in class_names:
    percentage = (detections_per_class[class_name] / total_detections * 100) if total_detections > 0 else 0
    detection_percentages.append(percentage)

plt.pie(detection_percentages, labels=class_names, autopct='%1.1f%%', colors=['red', 'green', 'blue', 'orange'])
plt.title('Detection Distribution')

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, 'analysis_results.png'), dpi=300, bbox_inches='tight')
plt.show()

# Save detailed results to JSON
results_data = {
    'total_detections': total_detections,
    'images_processed': len(results),
    'detections_per_class': dict(detections_per_class),
    'average_confidence_per_class': {
        class_name: np.mean(scores) if scores else 0 
        for class_name, scores in confidence_scores.items()
    }
}

with open(os.path.join(OUTPUT_DIR, 'test_results.json'), 'w') as f:
    json.dump(results_data, f, indent=2)

print(f"\nResults saved to: {OUTPUT_DIR}")
print(f"- Predicted images: {OUTPUT_DIR}/predictions/")
print(f"- Analysis chart: {OUTPUT_DIR}/analysis_results.png")
print(f"- Results JSON: {OUTPUT_DIR}/test_results.json")
