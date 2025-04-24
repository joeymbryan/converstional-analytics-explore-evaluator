import requests
import json

def test_analyze_explore(model_name, explore_name):
    url = "http://localhost:8080/analyze"
    
    payload = {
        "model_name": model_name,
        "explore_name": explore_name
    }
    headers = {
        "Content-Type": "application/json"
    }
    
    print(f"\nTesting analyze endpoint with {model_name}/{explore_name}")
    print("=" * 50)
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print("\nAnalysis Results:")
            print("-" * 30)
            print(f"Status: {result.get('status', 'unknown')}")
            
            if result.get('status') == 'success':
                print(f"\nGrade: {result.get('grade', 'N/A')}")
                print(f"\nRationale: {result.get('rationale', 'N/A')}")
                
                print("\nTop Used Fields:")
                for field, score in result.get('top_used_fields', []):
                    print(f"- {field}: {score}")
                
                print("\nRecommendations:")
                for i, rec in enumerate(result.get('recommendations', []), 1):
                    print(f"{i}. {rec}")
                
                print("\nAgent Instructions:")
                for i, instr in enumerate(result.get('agent_instructions', []), 1):
                    print(f"{i}. {instr}")
            else:
                print(f"Error: {result.get('error', 'Unknown error')}")
                if 'traceback' in result:
                    print("\nTraceback:")
                    print(result['traceback'])
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error making request: {str(e)}")
    
    print("\n" + "=" * 50)

if __name__ == "__main__":
    # Test cases
    test_cases = [
        {
            "model_name": "basic_ecomm",
            "explore_name": "basic_order_items"
        },
        # Add more test cases as needed
    ]
    
    for test_case in test_cases:
        test_analyze_explore(test_case["model_name"], test_case["explore_name"]) 