import os
from dotenv import load_dotenv
from swarm import Swarm, Agent
from typing import Dict, List, Any

load_dotenv()

# Initialize Swarm client
client = Swarm()

# Agent configurations
def create_coordinator_agent():
    """Creates the main coordinator agent that manages task delegation"""
    return Agent(
        name="Coordinator",
        instructions="""You are the main coordinator agent. Your responsibilities include:
        1. Understanding user requests and breaking them down into subtasks
        2. Delegating tasks to appropriate specialized agents
        3. Aggregating results from multiple agents
        4. Providing comprehensive responses to users
        
        You coordinate between:
        - Research Agent: For gathering information
        - Code Agent: For writing and reviewing code
        - Data Agent: For data processing and analysis
        - QA Agent: For testing and quality assurance
        
        Always provide clear, structured responses.""",
    )

def create_research_agent():
    """Creates a research agent for information gathering"""
    return Agent(
        name="Research Agent",
        instructions="""You are a research specialist. Your responsibilities include:
        1. Gathering information from various sources
        2. Fact-checking and verifying information
        3. Summarizing findings in a clear, concise manner
        4. Providing citations and references when applicable
        
        Focus on accuracy and relevance in your research.""",
    )

def create_code_agent():
    """Creates a code generation and review agent"""
    return Agent(
        name="Code Agent",
        instructions="""You are a code specialist. Your responsibilities include:
        1. Writing clean, efficient, and well-documented code
        2. Reviewing code for best practices and potential issues
        3. Suggesting optimizations and improvements
        4. Explaining complex code concepts clearly
        
        Follow the project's coding standards and conventions.""",
    )

def create_data_agent():
    """Creates a data processing and analysis agent"""
    return Agent(
        name="Data Agent",
        instructions="""You are a data specialist. Your responsibilities include:
        1. Processing and analyzing data efficiently
        2. Creating data visualizations and reports
        3. Identifying patterns and insights
        4. Ensuring data quality and integrity
        
        Focus on accuracy and meaningful insights.""",
    )

def create_qa_agent():
    """Creates a quality assurance agent"""
    return Agent(
        name="QA Agent",
        instructions="""You are a quality assurance specialist. Your responsibilities include:
        1. Testing functionality and edge cases
        2. Identifying bugs and potential issues
        3. Verifying requirements are met
        4. Suggesting improvements for reliability
        
        Be thorough and systematic in your testing approach.""",
    )

# Agent registry
AGENTS = {
    "coordinator": create_coordinator_agent(),
    "research": create_research_agent(),
    "code": create_code_agent(),
    "data": create_data_agent(),
    "qa": create_qa_agent(),
}

# Helper functions for agent interactions
def transfer_to_agent(agent_name: str):
    """Transfer control to a specific agent"""
    if agent_name in AGENTS:
        return AGENTS[agent_name]
    else:
        raise ValueError(f"Unknown agent: {agent_name}")

def get_agent_by_task(task_type: str):
    """Get the appropriate agent based on task type"""
    task_mapping = {
        "research": "research",
        "code": "code",
        "data": "data",
        "testing": "qa",
        "quality": "qa",
        "coordinate": "coordinator",
    }
    
    for keyword, agent_name in task_mapping.items():
        if keyword in task_type.lower():
            return AGENTS[agent_name]
    
    return AGENTS["coordinator"]  # Default to coordinator

# Tool functions that agents can use
def search_web(query: str) -> str:
    """Tool for web searching (placeholder - integrate with actual search API)"""
    return f"Search results for: {query}"

def analyze_code(code: str) -> Dict[str, Any]:
    """Tool for code analysis"""
    return {
        "lines": len(code.split('\n')),
        "complexity": "medium",
        "suggestions": ["Consider adding error handling", "Add type hints"]
    }

def process_data(data: List[Any]) -> Dict[str, Any]:
    """Tool for data processing"""
    return {
        "count": len(data),
        "summary": "Data processed successfully",
        "insights": ["Pattern identified", "Anomaly detected"]
    }

# Register tools with agents
AGENTS["research"].functions = [search_web]
AGENTS["code"].functions = [analyze_code]
AGENTS["data"].functions = [process_data]

# Update coordinator with transfer functions
AGENTS["coordinator"].functions = [
    lambda task: transfer_to_agent("research"),
    lambda task: transfer_to_agent("code"),
    lambda task: transfer_to_agent("data"),
    lambda task: transfer_to_agent("qa"),
]

print("✓ Swarm configuration loaded successfully")
print(f"✓ {len(AGENTS)} agents configured: {', '.join(AGENTS.keys())}")