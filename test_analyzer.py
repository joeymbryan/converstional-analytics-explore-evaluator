import os
import json
from looker_ca_analyzer import analyze_lookml

def test_analyzer():
    # Set the path to your looker.ini file
    os.environ['LOOKER_INI_PATH'] = 'looker.ini'
    
    # Test cases
    test_cases = [
        {
            "model_name": "basic_ecomm",
            "explore_name": "basic_order_items"
        },
        # Add more test cases as needed
    ]
    
    for test_case in test_cases:
        print(f"\nTesting with model: {test_case['model_name']}, explore: {test_case['explore_name']}")
        print("=" * 50)
        
        try:
            result = analyze_lookml(
                explore_name=test_case['explore_name'],
                model_name=test_case['model_name']
            )
            
            # Print the results in a readable format
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
                
        except Exception as e:
            print(f"Error during analysis: {str(e)}")
        
        print("\n" + "=" * 50)

if __name__ == "__main__":
    test_analyzer() 