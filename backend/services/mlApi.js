const axios = require('axios');
const FormData = require('form-data');

class MLApiService {
  constructor() {
    this.baseURL = process.env.ML_API_URL;
    this.apiKey = process.env.ML_API_KEY;
  }

  async detectHazard(imageBuffer, mimeType = 'image/jpeg') {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: 'image',
        contentType: mimeType
      });

      const config = {
        method: 'POST',
        url: `${this.baseURL}/predict`,
        data: formData,
        headers: {
          ...formData.getHeaders(),
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        timeout: 30000 // 30 second timeout
      };

      const response = await axios(config);

      if (response.status === 200) {
        return this.processMLResponse(response.data);
      } else {
        throw new Error(`ML API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('ML API Error:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('ML API service is unavailable');
      } else if (error.response) {
        throw new Error(`ML API error: ${error.response.data?.message || error.response.statusText}`);
      } else {
        throw new Error(`ML API request failed: ${error.message}`);
      }
    }
  }

  processMLResponse(data) {
    // Expected ML API response format:
    // {
    //   "predictions": [
    //     {
    //       "class": "pothole",
    //       "confidence": 0.85,
    //       "bbox": [x1, y1, x2, y2]
    //     }
    //   ],
    //   "processing_time": 1.2
    // }

    if (!data.predictions || !Array.isArray(data.predictions)) {
      return {
        hazardType: 'other',
        confidence: 0.0,
        detections: [],
        processingTime: data.processing_time || 0
      };
    }

    // Get the highest confidence detection
    const bestDetection = data.predictions.reduce((best, current) => {
      return current.confidence > best.confidence ? current : best;
    }, { confidence: 0 });

    // Map ML model classes to our hazard types
    const hazardTypeMapping = {
      'pothole': 'pothole',
      'damaged_road': 'damaged_road',
      'fallen_tree': 'fallen_tree',
      'debris': 'debris',
      'cattle': 'cattle_on_road',
      'cow': 'cattle_on_road',
      'animal': 'cattle_on_road',
      'flood': 'flooding',
      'water': 'flooding',
      'barrier': 'broken_barrier',
      'fence': 'broken_barrier',
      'traffic_light': 'traffic_light_issue',
      'sign': 'signage_damage',
      'signage': 'signage_damage'
    };

    const hazardType = hazardTypeMapping[bestDetection.class?.toLowerCase()] || 'other';
    
    return {
      hazardType,
      confidence: bestDetection.confidence || 0,
      detections: data.predictions.map(pred => ({
        class: pred.class,
        confidence: pred.confidence,
        bbox: pred.bbox
      })),
      processingTime: data.processing_time || 0
    };
  }

  async getModelInfo() {
    try {
      const response = await axios.get(`${this.baseURL}/info`, {
        headers: {
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('ML API Info Error:', error.message);
      throw new Error('Failed to get ML model information');
    }
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });

      return {
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        data: response.data
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Batch processing for multiple images
  async detectHazardsBatch(images) {
    try {
      const formData = new FormData();
      
      images.forEach((image, index) => {
        formData.append('files', image.buffer, {
          filename: `image_${index}`,
          contentType: image.mimeType
        });
      });

      const config = {
        method: 'POST',
        url: `${this.baseURL}/predict/batch`,
        data: formData,
        headers: {
          ...formData.getHeaders(),
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        timeout: 60000 // 60 second timeout for batch
      };

      const response = await axios(config);

      if (response.status === 200) {
        return response.data.results.map(result => this.processMLResponse(result));
      } else {
        throw new Error(`ML API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('ML API Batch Error:', error.message);
      throw new Error(`Batch ML processing failed: ${error.message}`);
    }
  }

  // Video processing (if supported by ML API)
  async detectHazardInVideo(videoBuffer, mimeType = 'video/mp4') {
    try {
      const formData = new FormData();
      formData.append('file', videoBuffer, {
        filename: 'video',
        contentType: mimeType
      });

      const config = {
        method: 'POST',
        url: `${this.baseURL}/predict/video`,
        data: formData,
        headers: {
          ...formData.getHeaders(),
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        timeout: 120000 // 2 minute timeout for video
      };

      const response = await axios(config);

      if (response.status === 200) {
        return {
          hazardType: response.data.hazard_type || 'other',
          confidence: response.data.confidence || 0,
          frames: response.data.frames || [],
          processingTime: response.data.processing_time || 0
        };
      } else {
        throw new Error(`ML API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('ML API Video Error:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('ML API service is unavailable');
      } else if (error.response?.status === 501) {
        throw new Error('Video processing not supported by ML API');
      } else {
        throw new Error(`Video ML processing failed: ${error.message}`);
      }
    }
  }
}

module.exports = new MLApiService();
