"""
Conversation Analytics Module

This module provides functionality to analyze Looker Explores for Conversational Analytics readiness.
It evaluates various aspects of the Explore including:
- Dimension and measure completeness
- Naming conventions
- Data types
- Join relationships
- Time-based analysis capabilities
"""

from typing import Dict, List, Optional, Any
import logging
from dataclasses import dataclass
from enum import Enum

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AnalysisStatus(Enum):
    """Status of the analysis for a specific aspect."""
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"

@dataclass
class AnalysisResult:
    """Result of analyzing a specific aspect of the Explore."""
    status: AnalysisStatus
    message: str
    details: Optional[Dict[str, Any]] = None

class ConversationAnalyticsAnalyzer:
    """Main class for analyzing Looker Explores for Conversational Analytics readiness."""
    
    def __init__(self, explore_data: Dict[str, Any]):
        """
        Initialize the analyzer with Explore data.
        
        Args:
            explore_data: Dictionary containing the Explore's metadata and structure
        """
        self.explore_data = explore_data
        self.results: Dict[str, AnalysisResult] = {}
    
    def analyze_dimensions(self) -> AnalysisResult:
        """Analyze the dimensions in the Explore."""
        dimensions = self.explore_data.get('dimensions', [])
        if not dimensions:
            return AnalysisResult(
                status=AnalysisStatus.FAIL,
                message="No dimensions found in the Explore"
            )
        
        # Check for required dimensions
        required_dimensions = ['date', 'user_id', 'session_id']
        missing_dimensions = [dim for dim in required_dimensions 
                            if not any(d['name'] == dim for d in dimensions)]
        
        if missing_dimensions:
            return AnalysisResult(
                status=AnalysisStatus.FAIL,
                message=f"Missing required dimensions: {', '.join(missing_dimensions)}"
            )
        
        return AnalysisResult(
            status=AnalysisStatus.PASS,
            message="All required dimensions are present",
            details={"dimension_count": len(dimensions)}
        )
    
    def analyze_measures(self) -> AnalysisResult:
        """Analyze the measures in the Explore."""
        measures = self.explore_data.get('measures', [])
        if not measures:
            return AnalysisResult(
                status=AnalysisStatus.WARNING,
                message="No measures found in the Explore"
            )
        
        # Check for basic metrics
        basic_metrics = ['count', 'sum', 'average']
        metric_coverage = sum(1 for m in measures 
                            if any(bm in m['name'].lower() for bm in basic_metrics))
        
        if metric_coverage < 2:
            return AnalysisResult(
                status=AnalysisStatus.WARNING,
                message="Limited metric coverage detected"
            )
        
        return AnalysisResult(
            status=AnalysisStatus.PASS,
            message="Sufficient measure coverage",
            details={"measure_count": len(measures)}
        )
    
    def analyze_joins(self) -> AnalysisResult:
        """Analyze the join relationships in the Explore."""
        joins = self.explore_data.get('joins', [])
        if not joins:
            return AnalysisResult(
                status=AnalysisStatus.WARNING,
                message="No joins defined in the Explore"
            )
        
        # Check for proper join relationships
        has_primary_join = any(j.get('type') == 'left_outer' for j in joins)
        if not has_primary_join:
            return AnalysisResult(
                status=AnalysisStatus.WARNING,
                message="No primary left outer join detected"
            )
        
        return AnalysisResult(
            status=AnalysisStatus.PASS,
            message="Join structure appears valid",
            details={"join_count": len(joins)}
        )
    
    def analyze_time_dimensions(self) -> AnalysisResult:
        """Analyze time-based dimensions in the Explore."""
        dimensions = self.explore_data.get('dimensions', [])
        time_dimensions = [d for d in dimensions if d.get('type') == 'time']
        
        if not time_dimensions:
            return AnalysisResult(
                status=AnalysisStatus.FAIL,
                message="No time dimensions found"
            )
        
        return AnalysisResult(
            status=AnalysisStatus.PASS,
            message="Time dimensions present",
            details={"time_dimension_count": len(time_dimensions)}
        )
    
    def run_analysis(self) -> Dict[str, AnalysisResult]:
        """Run the complete analysis of the Explore."""
        analysis_methods = [
            ('dimensions', self.analyze_dimensions),
            ('measures', self.analyze_measures),
            ('joins', self.analyze_joins),
            ('time_dimensions', self.analyze_time_dimensions)
        ]
        
        for aspect, method in analysis_methods:
            try:
                self.results[aspect] = method()
            except Exception as e:
                logger.error(f"Error analyzing {aspect}: {str(e)}")
                self.results[aspect] = AnalysisResult(
                    status=AnalysisStatus.FAIL,
                    message=f"Error during analysis: {str(e)}"
                )
        
        return self.results
    
    def get_summary(self) -> Dict[str, Any]:
        """Get a summary of the analysis results."""
        if not self.results:
            self.run_analysis()
        
        total_aspects = len(self.results)
        passed_aspects = sum(1 for r in self.results.values() 
                           if r.status == AnalysisStatus.PASS)
        failed_aspects = sum(1 for r in self.results.values() 
                           if r.status == AnalysisStatus.FAIL)
        
        return {
            'total_aspects': total_aspects,
            'passed_aspects': passed_aspects,
            'failed_aspects': failed_aspects,
            'warning_aspects': total_aspects - passed_aspects - failed_aspects,
            'overall_status': AnalysisStatus.PASS if failed_aspects == 0 
                            else AnalysisStatus.FAIL,
            'details': {k: {'status': v.status.value, 'message': v.message} 
                       for k, v in self.results.items()}
        } 