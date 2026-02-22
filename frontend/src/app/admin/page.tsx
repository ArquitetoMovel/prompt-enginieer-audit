"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createRepository,
  fetchRepositories,
  updateRepository,
  deleteRepository,
} from "@/services/api";
import { Save, AlertCircle, ArrowLeft, Edit2, Trash2 } from "lucide-react";
import Link from "next/link";
import { Repository } from "@/types";

export default function AdminPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    setFetching(true);
    try {
      const repos = await fetchRepositories();
      setRepositories(repos);
    } catch {
      setError("Failed to load repositories.");
    } finally {
      setFetching(false);
    }
  };

  const handleEdit = (repo: Repository) => {
    setEditingId(repo.id);
    setName(repo.name);
    setUrl(repo.url);
    setPrNumber(repo.prNumber ? repo.prNumber.toString() : "");
    setTagsInput(repo.tags ? repo.tags.join(", ") : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este repositório?")) return;
    try {
      await deleteRepository(id);
      setRepositories(repositories.filter((r) => r.id !== id));
      if (editingId === id) resetForm();
    } catch {
      alert("Falha ao deletar o repositório");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setUrl("");
    setPrNumber("");
    setTagsInput("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!name.trim() || !url.trim()) {
      setError("Nome e URL são obrigatórios.");
      setLoading(false);
      return;
    }

    const tagsArray = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      if (editingId) {
        await updateRepository(
          editingId,
          name,
          url,
          prNumber ? parseInt(prNumber) : null,
          tagsArray,
        );
      } else {
        await createRepository(
          name,
          url,
          prNumber ? parseInt(prNumber) : undefined,
          tagsArray,
        );
      }
      resetForm();
      await loadRepositories();
    } catch {
      setError("Falha ao salvar o repositório. Por favor, tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400 tracking-tight">
            Gerenciar Repositórios
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-8">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
              {editingId ? "Editar Repositório" : "Registrar Novo Repositório"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/30">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle
                        className="h-5 w-5 text-red-400"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                        {error}
                      </h3>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  Nome do Repositório
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 pl-4 py-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-white transition-all duration-200 border outline-none"
                  placeholder="ex: prompt-engineer-audit"
                />
              </div>

              <div>
                <label
                  htmlFor="url"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  GitHub URL
                </label>
                <input
                  type="url"
                  id="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 pl-4 py-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-white transition-all duration-200 border outline-none"
                  placeholder="https://github.com/owner/repository"
                />
              </div>

              <div>
                <label
                  htmlFor="prNumber"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  Pull Request Padrão{" "}
                  <span className="text-xs text-gray-500 font-normal">
                    (Opcional)
                  </span>
                </label>
                <input
                  type="number"
                  id="prNumber"
                  value={prNumber}
                  onChange={(e) => setPrNumber(e.target.value)}
                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 pl-4 py-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-white transition-all duration-200 border outline-none"
                  placeholder="ex: 12"
                />
              </div>

              <div>
                <label
                  htmlFor="tagsInput"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  Tags{" "}
                  <span className="text-xs text-gray-500 font-normal">
                    (Separadas por vírgula)
                  </span>
                </label>
                <input
                  type="text"
                  id="tagsInput"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 pl-4 py-3 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-white transition-all duration-200 border outline-none"
                  placeholder="ex: frontend, react, critical"
                />
              </div>

              <div className="pt-4 flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white transition-all duration-200 ${
                    loading
                      ? "bg-indigo-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 hover:scale-[1.02] transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  }`}
                >
                  {loading ? (
                    <>Salvando...</>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      {editingId ? "Atualizar" : "Salvar"} Repositório
                    </>
                  )}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 overflow-y-auto max-h-[800px]">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
              Repositórios Registrados
            </h2>
            {fetching ? (
              <div className="text-center text-gray-500 dark:text-gray-400">
                Carregando...
              </div>
            ) : repositories.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400">
                Nenhum repositório registrado ainda.
              </div>
            ) : (
              <ul className="space-y-4">
                {repositories.map((repo) => (
                  <li
                    key={repo.id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex flex-col space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {repo.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                          {repo.url}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(repo)}
                          className="p-2 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900 rounded-lg transition-colors"
                          title="Editar Repositório"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(repo.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900 rounded-lg transition-colors"
                          title="Excluir Repositório"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {repo.tags && repo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {repo.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
