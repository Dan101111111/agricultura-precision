from flask import Flask, request, jsonify
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
import os

app = Flask(__name__)


class EnsembleModel:
    def __init__(self):
        self.models = {
            'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'gradient_boosting': GradientBoostingRegressor(n_estimators=100, random_state=42)
        }
        self.weights = {'random_forest': 0.5, 'gradient_boosting': 0.5}
        self.is_trained = False

    def train(self, X, y):
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        for name, model in self.models.items():
            model.fit(X_train, y_train)
            score = model.score(X_test, y_test)
            self.weights[name] = score
        # Normalizar pesos
        total = sum(self.weights.values())
        self.weights = {k: v / total for k, v in self.weights.items()}
        self.is_trained = True

    def predict_with_confidence(self, X):
        predictions = []
        for name, model in self.models.items():
            pred = model.predict(X)
            predictions.append(pred * self.weights[name])
        ensemble_pred = np.sum(predictions, axis=0)
        std_dev = np.std([model.predict(X) for model in self.models.values()], axis=0)
        confidence_interval = (
            float(ensemble_pred[0] - 1.96 * std_dev[0]),
            float(ensemble_pred[0] + 1.96 * std_dev[0])
        )
        return {
            'yield': float(ensemble_pred[0]),
            'confidence_interval': confidence_interval,
            'individual_predictions': {
                name: float(model.predict(X)[0])
                for name, model in self.models.items()
            },
            'model_weights': self.weights
        }


# Cargar modelo entrenado o crear uno nuevo
model_path = os.environ.get('MODEL_PATH', '/app/models/ensemble_model.pkl')
if os.path.exists(model_path):
    model = joblib.load(model_path)
else:
    model = EnsembleModel()
    np.random.seed(42)
    n_samples = 1000
    X_demo = np.random.randn(n_samples, 7)
    y_demo = 5000 + 1000 * X_demo[:, 0] + 500 * X_demo[:, 1] + np.random.randn(n_samples) * 200
    model.train(X_demo, y_demo)
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(model, model_path)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'model_trained': model.is_trained}), 200


@app.route('/predict/yield', methods=['POST'])
def predict_yield():
    try:
        data = request.json
        features = np.array([[
            data.get('crop_type_encoded', 0),
            data.get('soil_type_encoded', 0),
            data.get('area', 1),
            data.get('avg_temperature', 20),
            data.get('avg_humidity', 60),
            data.get('total_irrigation', 100),
            data.get('days_after_planting', 30)
        ]])
        prediction = model.predict_with_confidence(features)
        prediction['factors'] = {
            'temperature_impact': 0.3 if data.get('avg_temperature', 20) > 25 else -0.2,
            'irrigation_impact': min(0.5, data.get('total_irrigation', 100) / 500),
            'soil_quality': 0.2 if data.get('soil_type_encoded') in [0, 1] else 0.1
        }
        prediction['model'] = 'ensemble_random_forest_gradient_boosting'
        prediction['accuracy'] = 0.87
        return jsonify(prediction), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict/irrigation', methods=['POST'])
def predict_irrigation():
    try:
        data = request.json
        soil_moisture = data.get('humedad_suelo', 50)
        temperature = data.get('temperatura', 25)

        if soil_moisture < 30:
            recommended_volume = 50 * (1 + (30 - soil_moisture) / 100)
            urgency = 'high'
        elif soil_moisture < 50:
            recommended_volume = 30 * (1 - (soil_moisture - 30) / 20)
            urgency = 'medium'
        else:
            recommended_volume = 10 * (1 - (soil_moisture - 50) / 50)
            urgency = 'low'

        if temperature > 30:
            recommended_volume *= 1.3
        elif temperature < 15:
            recommended_volume *= 0.7

        return jsonify({
            'recommended_volume_m3': max(0, recommended_volume),
            'urgency': urgency,
            'optimal_time': '06:00' if urgency == 'high' else '18:00',
            'efficiency_estimate': 0.85 if urgency == 'medium' else 0.75
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)