from flask import Flask, request
import os
from main import hello
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow all origins for testing

@app.route('/analyze', methods=['POST'])
def analyze():
    return hello(request)

if __name__ == '__main__':
    # Set the environment variable for the looker.ini file
    os.environ['LOOKER_INI_PATH'] = 'looker.ini'
    
    # Run the Flask app
    app.run(host='localhost', port=8082, debug=True) 