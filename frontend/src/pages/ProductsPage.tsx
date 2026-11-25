import React, { useState } from "react";
import {
  Plus,
  Check,
  Edit2,
  Trash2,
  RotateCcw,
  Layers,
  Image as ImageIcon,
  Upload,
  AlertCircle,
  Loader2,
  Info,
  Archive,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/layout/PageHeader";
import { DataTable, Column } from "../components/shared/DataTable";
import { SearchInput } from "../components/shared/SearchInput";
import { FilterDropdown } from "../components/shared/FilterDropdown";
import { FormDialog } from "../components/shared/FormDialog";
import { ConfirmationDialog } from "../components/shared/ConfirmationDialog";
import { LoadingState } from "../components/shared/LoadingState";
import { ErrorState } from "../components/shared/ErrorState";
import { formatCurrency, getApiErrorMessage, resolveMediaUrl } from "../lib/utils";
import { apiClient } from "../lib/api";
import { Product, ProductCategoryItem } from "../types";
import { useDashboardSearch } from "../layouts/DashboardLayout";

function deriveProductCategoryEnum(cat?: ProductCategoryItem): string {
  const text = `${cat?.slug || ""} ${cat?.name || ""}`.toLowerCase();
  if (text.includes("frame")) return "PHOTO_FRAME";
  if (text.includes("album") || text.includes("magazine")) return "MAGAZINE_ALBUM";
  if (text.includes("hamper") || text.includes("box")) return "GIFT_HAMPER";
  return "CUSTOM_GIFT";
}

export function ProductsPage() {
  const queryClient = useQueryClient();
  const globalSearch = useDashboardSearch();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [productToArchive, setProductToArchive] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<number | "">("");
  const [formPrice, setFormPrice] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Category management form states
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [catError, setCatError] = useState<string | null>(null);

  // Fetch Categories
  const { data: categories = [] } = useQuery<ProductCategoryItem[]>({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const res = await apiClient.get("/product-categories");
      return res.data?.data || [];
    },
  });

  // Fetch Products List
  const effectiveSearch = search || globalSearch;
  const {
    data: products = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Product[]>({
    queryKey: ["products", effectiveSearch, categoryFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (effectiveSearch) params.search = effectiveSearch;
      if (categoryFilter !== "ALL") params.category_id = categoryFilter;

      if (statusFilter === "ACTIVE") {
        params.is_active = 1;
      } else if (statusFilter === "INACTIVE") {
        params.is_active = 0;
      } else if (statusFilter === "ARCHIVED") {
        params.include_archived = "true";
      }

      const res = await apiClient.get("/products", { params });
      let list: Product[] = res.data?.data?.data || res.data?.data || [];

      if (statusFilter === "ARCHIVED") {
        list = list.filter((p: any) => p.deleted_at !== null);
      }
      return list;
    },
  });

  // Create Product Mutation
  const createProductMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/products", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(getApiErrorMessage(err, "Failed to create product."));
    },
  });

  // Update Product Mutation
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.put(`/products/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setIsEditOpen(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(getApiErrorMessage(err, "Failed to update product."));
    },
  });

  // Archive (Soft-delete) Product Mutation
  const archiveProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/products/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setProductToArchive(null);
    },
    onError: (err: any) => {
      alert("Error archiving product: " + getApiErrorMessage(err, "Request failed."));
    },
  });

  // Restore Product Mutation
  const restoreProductMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.patch(`/products/${id}/restore`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
    },
    onError: (err: any) => {
      alert("Error restoring product: " + getApiErrorMessage(err, "Request failed."));
    },
  });

  // Add Category Mutation
  const addCategoryMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post("/product-categories", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setNewCatName("");
      setNewCatDesc("");
      setCatError(null);
    },
    onError: (err: any) => {
      setCatError(getApiErrorMessage(err, "Could not add category."));
    },
  });

  // Delete Category Mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/product-categories/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setCatError(null);
    },
    onError: (err: any) => {
      setCatError(getApiErrorMessage(err, "Could not delete category."));
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormCategoryId(categories[0]?.id || "");
    setFormPrice("");
    setFormDesc("");
    setFormImageUrl("");
    setFormIsActive(true);
    setFormError(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategoryId(p.category_id || "");
    setFormPrice(String(p.base_price));
    setFormDesc(p.description || "");
    setFormImageUrl(p.image_url || "");
    setFormIsActive(p.is_active);
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const catId = formCategoryId ? Number(formCategoryId) : null;
    const selectedCategory = catId ? categories.find((c) => c.id === catId) : undefined;
    const derivedCategory = selectedCategory
      ? deriveProductCategoryEnum(selectedCategory)
      : editingProduct?.category || "CUSTOM_GIFT";

    const payload = {
      name: formName.trim(),
      category_id: catId,
      category: derivedCategory,
      base_price: parseFloat(formPrice) || 0,
      description: formDesc.trim() || null,
      image_url: formImageUrl.trim() || null,
      is_active: formIsActive ? 1 : 0,
    };

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, payload });
    } else {
      createProductMutation.mutate(payload);
    }
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setIsUploadingImage(true);
      const res = await apiClient.post("/products/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFormImageUrl(res.data?.data?.url || "");
    } catch (err: any) {
      alert("Image upload failed: " + getApiErrorMessage(err, "Upload error."));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const columns: Column<Product>[] = [
    {
      header: "Offering & Craft Details",
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.image_url ? (
            <img
              src={resolveMediaUrl(row.image_url)}
              alt={row.name}
              className="h-10 w-10 rounded-lg object-cover border border-stone-200"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-400">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="font-semibold text-stone-900">{row.name}</p>
            <p className="text-2xs text-stone-500 max-w-sm line-clamp-1">{row.description}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Category",
      cell: (row) => {
        const catName =
          row.category_ref?.name ||
          row.category_relation?.name ||
          (row as any).category?.name ||
          row.category ||
          "Standard Offering";
        return (
          <span className="rounded-full bg-[#F7F4F0] border border-[#E7E1D8] px-2.5 py-0.5 text-2xs font-medium text-[#34312F]">
            {catName}
          </span>
        );
      },
    },
    {
      header: "Base Price",
      cell: (row) => (
        <span className="font-bold text-stone-900">{formatCurrency(row.base_price)}</span>
      ),
    },
    {
      header: "Status",
      cell: (row) => {
        const isArchived = (row as any).deleted_at !== null && (row as any).deleted_at !== undefined;
        if (isArchived) {
          return (
            <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-2xs font-semibold text-stone-600">
              <Archive className="h-3 w-3" />
              Archived
            </span>
          );
        }
        return row.is_active ? (
          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-700">
            <Check className="h-3 w-3" />
            Active
          </span>
        ) : (
          <span className="text-2xs font-semibold text-stone-400">Inactive</span>
        );
      },
    },
    {
      header: "Actions",
      cell: (row) => {
        const isArchived = (row as any).deleted_at !== null && (row as any).deleted_at !== undefined;
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {isArchived ? (
              <button
                type="button"
                onClick={() => restoreProductMutation.mutate(row.id)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                title="Restore Offering"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restore</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openEditModal(row)}
                  className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                  title="Edit Offering"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setProductToArchive(row)}
                  className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-700"
                  title="Archive Offering"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Craft Offerings"
        description="Standardized catalogue for frames, magazine photobooks, and bespoke gift hampers."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCatError(null);
                setIsCategoryModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7E1D8] bg-white px-3.5 py-2 text-xs font-medium text-[#34312F] shadow-soft hover:bg-[#F7F4F0] transition-colors"
            >
              <Layers className="h-3.5 w-3.5 text-[#817872]" />
              <span>Manage Categories</span>
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#34312F] px-4 py-2 text-xs font-medium text-white shadow-soft hover:bg-[#1F1D1C] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Offering</span>
            </button>
          </div>
        }
      />

      {/* Flexible Catalogue Notice */}
      <div className="flex items-start gap-2.5 rounded-2xl bg-[#FDFBF7] p-4 text-[#34312F] border border-[#E7E1D8]">
        <Info className="h-4 w-4 shrink-0 text-[#817872] mt-0.5" />
        <p className="text-xs leading-relaxed text-[#6B635B]">
          <strong className="text-[#34312F]">Catalogue Flexibility:</strong> This catalogue defines standard studio base offerings.
          Custom items, bespoke frames, and tailored gift packs can always be created on-the-fly
          during order creation without requiring pre-defined catalogue entries.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search products catalogue..."
        />
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <FilterDropdown
            label="Category"
            selectedValue={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { label: "All Categories", value: "ALL" },
              ...categories.map((c) => ({ label: c.name, value: String(c.id) })),
            ]}
          />
          <FilterDropdown
            label="Status"
            selectedValue={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: "Active Offerings", value: "ACTIVE" },
              { label: "Inactive", value: "INACTIVE" },
              { label: "Archived (Soft Deleted)", value: "ARCHIVED" },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading craft catalogue..." />
      ) : isError ? (
        <ErrorState
          title="Could not load catalogue"
          message={(error as any)?.message || "Failed to communicate with Laravel backend."}
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          data={products}
          columns={columns}
          emptyTitle="No offerings found"
          emptyMessage="No products match your search or category filter."
        />
      )}

      {/* ADD / EDIT OFFERING DIALOG */}
      {(isAddOpen || isEditOpen) && (
        <FormDialog
          isOpen={isAddOpen || isEditOpen}
          onClose={() => {
            setIsAddOpen(false);
            setIsEditOpen(false);
            setEditingProduct(null);
            resetForm();
          }}
          title={editingProduct ? `Edit Offering: ${editingProduct.name}` : "Add Craft Offering"}
          description="Create or modify a standardized base product offering."
          maxWidth="md"
        >
          <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-2xs font-medium">{formError}</p>
              </div>
            )}

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Product / Offering Name *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Acrylic Floating Couple Frame"
                className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Category *
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) =>
                    setFormCategoryId(e.target.value ? Number(e.target.value) : "")
                  }
                  required
                  className="w-full h-9 rounded-lg border border-stone-200 px-2 text-xs bg-white focus:outline-rose-600"
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                  Default Base Price (₹ INR) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  required
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="1650"
                  className="w-full h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Description & Craft Specifications
              </label>
              <textarea
                rows={2}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Dimensions, wood finish, acrylic thickness, archival quality..."
                className="w-full rounded-lg border border-stone-200 p-2 text-xs focus:outline-rose-600"
              />
            </div>

            {/* Image upload / URL */}
            <div>
              <label className="block text-2xs font-semibold text-stone-600 uppercase mb-1">
                Product Image
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="Paste image URL or upload file..."
                  className="flex-1 h-9 rounded-lg border border-stone-200 px-3 text-xs focus:outline-rose-600"
                />
                <label className="inline-flex items-center gap-1 h-9 rounded-lg border border-stone-300 bg-stone-50 px-3 text-2xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer">
                  {isUploadingImage ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              {formImageUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={resolveMediaUrl(formImageUrl)}
                    alt="Preview"
                    className="h-12 w-12 rounded object-cover border border-stone-200"
                  />
                  <span className="text-3xs text-stone-400 truncate">{formImageUrl}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_active_toggle"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded border-stone-300 text-rose-700 focus:ring-rose-600"
              />
              <label htmlFor="is_active_toggle" className="text-2xs font-medium text-stone-700">
                Mark offering as active in live catalogue
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setIsEditOpen(false);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-stone-700 hover:bg-stone-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createProductMutation.isPending || updateProductMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#34312F] px-4 py-1.5 text-white font-semibold hover:bg-[#1F1D1C] disabled:opacity-50"
              >
                {(createProductMutation.isPending || updateProductMutation.isPending) && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>{editingProduct ? "Update Offering" : "Save Offering"}</span>
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {/* CATEGORY MANAGEMENT MODAL */}
      {isCategoryModalOpen && (
        <FormDialog
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title="Product Categories"
          description="Manage taxonomy for frames, albums, bespoke hampers, and custom creations."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {catError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-2xs font-medium">{catError}</p>
              </div>
            )}

            {/* Add Category Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCatName.trim()) return;
                addCategoryMutation.mutate({
                  name: newCatName.trim(),
                  description: newCatDesc.trim() || null,
                });
              }}
              className="bg-stone-50 p-3 rounded-lg border border-stone-200/80 space-y-2"
            >
              <p className="font-bold text-stone-800 text-2xs uppercase tracking-wider">
                Create New Category
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category Name (e.g. Resin Keepsakes)"
                  className="h-8 rounded border border-stone-200 bg-white px-2.5 text-xs focus:outline-rose-600"
                />
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Short description..."
                  className="h-8 rounded border border-stone-200 bg-white px-2.5 text-xs focus:outline-rose-600"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addCategoryMutation.isPending || !newCatName.trim()}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#34312F] px-3 py-1.5 text-white font-semibold hover:bg-[#1F1D1C] disabled:opacity-50 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Category</span>
                </button>
              </div>
            </form>

            {/* Categories Table */}
            <div className="rounded-lg border border-stone-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium text-3xs uppercase">
                  <tr>
                    <th className="p-2.5">Category Name</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5">Items</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50">
                      <td className="p-2.5 font-semibold text-stone-900">{c.name}</td>
                      <td className="p-2.5 text-stone-500 text-2xs">{c.description || "—"}</td>
                      <td className="p-2.5 font-mono text-stone-600">
                        {c.products_count ?? 0}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => deleteCategoryMutation.mutate(c.id)}
                          disabled={(c.products_count ?? 0) > 0}
                          title={
                            (c.products_count ?? 0) > 0
                              ? "Cannot delete category containing active products"
                              : "Delete Category"
                          }
                          className="rounded p-1 text-stone-400 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-stone-700 hover:bg-stone-50 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </FormDialog>
      )}

      {/* CONFIRM ARCHIVE DIALOG */}
      {productToArchive && (
        <ConfirmationDialog
          isOpen={!!productToArchive}
          onClose={() => setProductToArchive(null)}
          onConfirm={() => archiveProductMutation.mutate(productToArchive.id)}
          title={`Archive Offering: ${productToArchive.name}?`}
          message="This offering will be archived and hidden from live creation selections. You can restore it anytime."
          confirmText="Archive Offering"
          cancelText="Keep"
          variant="danger"
        />
      )}
    </div>
  );
}
