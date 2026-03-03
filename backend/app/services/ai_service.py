import logging
from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.domain.models import PullRequest, AnalysisResultDomain

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        self.parser = JsonOutputParser(pydantic_object=AnalysisResultDomain)
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert AI code auditor. You are evaluating PR changes against AI development best practices.\n\n"
                      "RULES:\n"
                      "1. Detect agentic documentation inside directories like .github, .claude, .gemini, .agent, .agents, docs, specs, docs/specs, or files with keywords: SKILL, agent, plan, spec, tasks, task, instructions.\n"
                      "2. If ANY agentic documentation matching rule 1 is detected, you MUST set the status to 'PASS' (verde).\n"
                      "3. If NO agentic docs (no new or altered documentation matching rule 1) are detected in the PR, but at least one README file with relevant content is detected, set the status to 'PARCIAL' (amarelo).\n"
                      "4. If NO agentic docs and NO relevant README are detected in the PR, set status to 'FAIL' (vermelho).\n"
                      "5. Even if the status is 'PASS' or 'PARCIAL', you can still list violations if the documentation is incoherent with the source code implementation or missing critical contexts.\n"
                      "6. You can also use 'FAIL' if there's a catastrophic error in the analysis or if you explicitly determine the PR is entirely destructive.\n"
                      "7. Use 'NA' if the files cannot be analyzed properly.\n\n"
                      "8. Use 'FAIL' if the PR not contains any documentation.\n"
                      "Return the result exactly matching the requested JSON format, with a status field of 'FAIL', 'PARCIAL', 'PASS', or 'NA'."),
            ("user", "Analyze the following files:\n\n{files_context}\n\n{format_instructions}")
        ])

    async def analyze_pull_request(self, pr: PullRequest) -> AnalysisResultDomain:
        """
        Analyzes the files of a PullRequest using LangChain.
        """
        if not pr.files:
            return AnalysisResultDomain(
                status="NA",
                violations=[],
                summary="No accessible files found to audit."
            )

        files_context = ""
        for f in pr.files:
            files_context += f"--- {f.path} ---\n{f.content}\n\n"
            
        chain = self.prompt | self.llm | self.parser
        
        try:
            result_dict = await chain.ainvoke({
                "files_context": files_context,
                "format_instructions": self.parser.get_format_instructions()
            })
            
            return AnalysisResultDomain(
                status=result_dict.get("status", "FAIL"),
                violations=result_dict.get("violations", []),
                summary=result_dict.get("summary", "Analysis completed.")
            )
            
        except Exception as e:
            logger.error(f"LLM Analysis failed: {e}")
            return AnalysisResultDomain(
                status="FAIL",
                violations=[],
                summary=f"Analysis failed: {str(e)}"
            )
