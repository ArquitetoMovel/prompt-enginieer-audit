from langgraph.graph import StateGraph, START, END
from app.workflow.state import AuditState
from app.workflow.nodes import fetch_repo_state, analyze_files, generate_report
from langgraph.checkpoint.memory import MemorySaver

# Define the workflow
workflow = StateGraph(AuditState)

# Add nodes
workflow.add_node("fetch_repo_state", fetch_repo_state)
workflow.add_node("analyze_files", analyze_files)
workflow.add_node("generate_report", generate_report)

# Define edges
workflow.add_edge(START, "fetch_repo_state")
workflow.add_edge("fetch_repo_state", "analyze_files")
workflow.add_edge("analyze_files", "generate_report")
workflow.add_edge("generate_report", END)

# Compile the graph
checkpointer = MemorySaver()
app = workflow.compile(checkpointer=checkpointer)
