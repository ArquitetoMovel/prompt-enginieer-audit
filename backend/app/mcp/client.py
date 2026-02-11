import httpx
from typing import Any, Dict, List
from app.core.config import settings

class MCPClient:
    def __init__(self, base_url: str = settings.MCP_SERVER_URL):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url)

    async def list_tools(self) -> List[Dict[str, Any]]:
        response = await self.client.get("/tools")
        response.raise_for_status()
        return response.json()

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        response = await self.client.post("/tools/call", json={"name": tool_name, "arguments": arguments})
        response.raise_for_status()
        return response.json()

mcp_client = MCPClient()
