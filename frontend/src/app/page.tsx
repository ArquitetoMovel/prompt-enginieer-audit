"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Repository, ScanStatus } from "@/types";
import { fetchRepositories, runScan, fetchPullRequests } from "@/services/api";
import {
  RefreshCw,
  ExternalLink,
  Play,
  SearchCode,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import AuditResults from "@/components/AuditResults";

export default function Dashboard() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [repoPRs, setRepoPRs] = useState<Record<string, any[]>>({});
  const [loadingPRs, setLoadingPRs] = useState<Record<string, boolean>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filteredRepos = selectedTag
    ? repos.filter((repo) => repo.tags?.includes(selectedTag))
    : repos;

  const totalPages = Math.ceil(filteredRepos.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentRepos = filteredRepos.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag === selectedTag ? null : tag);
    setCurrentPage(1);
  };

  const clearTagFilter = () => {
    setSelectedTag(null);
    setCurrentPage(1);
  };

  const loadRepos = async () => {
    setLoading(true);
    const data = await fetchRepositories();
    setRepos(data);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line
    loadRepos();
  }, []);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/api/v1/ws");

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "repo_update") {
          const updatedRepo = message.data;

          setRepos((currentRepos) =>
            currentRepos.map((r) => {
              if (r.id === updatedRepo.id) {
                return {
                  ...r,
                  status: updatedRepo.ScanStatus || r.status,
                  prNumber: updatedRepo.PullRequest || r.prNumber,
                  lastScan: updatedRepo.LastScan || r.lastScan,
                  tags: updatedRepo.Tags || r.tags,
                };
              }
              return r;
            }),
          );

          // Clear scanning status if the backend signals completion or failure
          if (
            message.event === "audit_completed" ||
            message.event === "audit_failed" ||
            // Fallback for older messages
            (!message.event &&
              (updatedRepo.ScanStatus === "PASS" ||
                updatedRepo.ScanStatus === "FAIL"))
          ) {
            setScanning((current) =>
              current === updatedRepo.id ? null : current,
            );
          }
        }
      } catch (err) {
        console.error("Error parsing websocket message", err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleScan = async (repoId: string, url: string, prNumber: number) => {
    // Note: scanning state is now based on a unique key combining repo ID and PR Number
    const scanKey = `${repoId}-${prNumber}`;
    if (scanning) return;
    setScanning(repoId); // Using repoId for the global sync, though we could refine it
    try {
      await runScan(repoId, url, prNumber);
    } catch {
      setScanning(null);
    }
  };

  const toggleRepoExpansion = async (repo: Repository) => {
    const newExpanded = new Set(expandedRepos);
    if (newExpanded.has(repo.id)) {
      newExpanded.delete(repo.id);
      setExpandedRepos(newExpanded);
      return;
    }

    newExpanded.add(repo.id);
    setExpandedRepos(newExpanded);

    if (!repoPRs[repo.id]) {
      setLoadingPRs((prev) => ({ ...prev, [repo.id]: true }));
      try {
        const prs = await fetchPullRequests(repo.url);
        setRepoPRs((prev) => ({ ...prev, [repo.id]: prs }));
      } catch (err) {
        console.error("Failed to load PRs for", repo.name, err);
      } finally {
        setLoadingPRs((prev) => ({ ...prev, [repo.id]: false }));
      }
    }
  };

  const StatusIndicator = ({ status }: { status: ScanStatus }) => {
    const config = {
      NA: {
        color: "bg-white border-gray-300 dark:border-gray-500",
        shadow: "",
      },
      FAIL: {
        color: "bg-red-500 border-red-500",
        shadow: "shadow-[0_0_10px_rgba(239,68,68,0.6)]",
      },
      PARCIAL: {
        color: "bg-yellow-400 border-yellow-400",
        shadow: "shadow-[0_0_10px_rgba(250,204,21,0.6)]",
      },
      PASS: {
        color: "bg-green-500 border-green-500",
        shadow: "shadow-[0_0_10px_rgba(34,197,94,0.6)]",
      },
    };

    const { color, shadow } = config[status] || config.NA;
    return (
      <div className="flex items-center space-x-2">
        <span
          className={`w-4 h-4 rounded-full border-2 ${color} ${shadow} animate-pulse-slow`}
        ></span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {status}
        </span>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400 tracking-tight">
              Prompt Enginieer Audit Dashboard
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Evolução da adoção de agentes de IA nas entregas por projeto
            </p>
            {selectedTag && (
              <div className="mt-3 flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filtrando por tag:
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  {selectedTag}
                  <button
                    onClick={clearTagFilter}
                    className="ml-2 focus:outline-none hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                    aria-label="Limpar filtro"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </div>
            )}
          </div>
          <div className="mt-4 sm:mt-0">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-full shadow-lg text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 hover:scale-105 transform transition-all duration-200"
            >
              Adicionar Novo Repositório
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90 transition-all duration-300">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Nome do repositório
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Tags
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    URL github
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-4" />
                      Carregando repositórios...
                    </td>
                  </tr>
                ) : repos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      <div className="flex flex-col items-center">
                        <SearchCode className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-lg font-medium">
                          Nenhum repositório encontrado
                        </p>
                        <p className="text-sm mt-1">
                          Comece adicionando um novo repositório para analisar.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentRepos.map((repo) => (
                    <React.Fragment key={repo.id}>
                      <tr
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200 ${expandedRepos.has(repo.id) ? "bg-indigo-50/30 dark:bg-indigo-900/10" : ""}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {repo.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {repo.tags && repo.tags.length > 0 ? (
                              repo.tags.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => handleTagClick(tag)}
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                                    selectedTag === tag
                                      ? "bg-indigo-500 text-white dark:bg-indigo-600 dark:text-white shadow-sm"
                                      : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
                                  }`}
                                >
                                  {tag}
                                </button>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">
                                Sem tags
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center group transition-colors"
                          >
                            <span className="truncate max-w-[200px]">
                              {repo.url}
                            </span>
                            <ExternalLink className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex justify-center">
                            <StatusIndicator status={repo.status} />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center space-x-3">
                            <button
                              onClick={() => setSelectedAuditId(repo.id)}
                              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 hover:underline transition-all"
                            >
                              Resultados Globais
                            </button>
                            <button
                              onClick={() => toggleRepoExpansion(repo)}
                              className="inline-flex items-center px-4 py-1.5 border border-transparent text-xs font-bold rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                            >
                              {expandedRepos.has(repo.id)
                                ? "Ocultar PRs"
                                : "Listar PRs"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRepos.has(repo.id) && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-0 bg-gray-50/50 dark:bg-gray-800/30"
                          >
                            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                              {loadingPRs[repo.id] ? (
                                <div className="flex items-center justify-center p-4">
                                  <RefreshCw className="w-5 h-5 mr-2 animate-spin text-indigo-500" />
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Buscando PRs no GitHub...
                                  </span>
                                </div>
                              ) : repoPRs[repo.id] &&
                                repoPRs[repo.id].length > 0 ? (
                                <div className="space-y-3">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center mb-2">
                                    <SearchCode className="w-4 h-4 mr-1 text-gray-500" />{" "}
                                    PULL REQUESTS RECENTES
                                  </h4>
                                  <ul className="grid grid-cols-1 gap-3">
                                    {repoPRs[repo.id].map((pr) => (
                                      <li
                                        key={pr.number}
                                        className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                                      >
                                        <div className="flex flex-col">
                                          <div className="flex items-center">
                                            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 mr-2">
                                              #{pr.number}
                                            </span>
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px] sm:max-w-xs">
                                              {pr.title || "Sem título"}
                                            </span>
                                          </div>
                                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-1">
                                            {pr.created_at
                                              ? new Date(
                                                  pr.created_at,
                                                ).toLocaleDateString()
                                              : "Data Desconhecida"}
                                          </span>
                                        </div>
                                        <button
                                          onClick={() =>
                                            handleScan(
                                              repo.id,
                                              repo.url,
                                              pr.number,
                                            )
                                          }
                                          disabled={scanning === repo.id}
                                          className={`ml-4 shrink-0 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-full shadow-sm text-white ${
                                            scanning === repo.id
                                              ? "bg-gray-400 cursor-not-allowed"
                                              : "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 hover:scale-105 transform transition-all duration-200"
                                          }`}
                                        >
                                          {scanning === repo.id ? (
                                            <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                                          ) : (
                                            <Play className="w-3.5 h-3.5 mr-1" />
                                          )}
                                          Analisar
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">
                                  Nenhum Pull Request modificado recentemente
                                  encontrado.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && repos.length > 0 && (
            <div className="bg-white dark:bg-gray-800/80 px-4 py-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 sm:px-6">
              <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <p className="text-sm text-gray-700 dark:text-gray-300 order-2 sm:order-1">
                    Exibindo{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {filteredRepos.length > 0 ? startIndex + 1 : 0}
                    </span>{" "}
                    a{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {Math.min(
                        startIndex + itemsPerPage,
                        filteredRepos.length,
                      )}
                    </span>{" "}
                    de{" "}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {filteredRepos.length}
                    </span>{" "}
                    resultados
                  </p>
                  <div className="flex items-center space-x-2 order-1 sm:order-2">
                    <label
                      htmlFor="perPage"
                      className="text-sm font-medium text-gray-700 dark:text-gray-300 w-max"
                    >
                      Por página:
                    </label>
                    <select
                      id="perPage"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="block w-full pl-3 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm"
                    >
                      <option value={9}>9</option>
                      <option value={15}>15</option>
                      <option value={30}>30</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
                <div>
                  <nav
                    className="relative z-0 inline-flex shadow-sm rounded-md isolate"
                    aria-label="Pagination"
                  >
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="sr-only">Anterior</span>
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="sr-only">Próxima</span>
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedAuditId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm sm:p-0">
          <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Resultados da Análise
              </h2>
              <button
                onClick={() => setSelectedAuditId(null)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <AuditResults auditId={selectedAuditId} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
