<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\ProductCategory;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class ProductCategoryController extends BaseApiController
{
    public function index(): JsonResponse
    {
        $categories = ProductCategory::withCount('products')->get();
        return $this->sendResponse($categories);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $slug = Str::slug($validated['name']);
        $normalizedName = strtolower(trim($validated['name']));
        if (
            ProductCategory::where('slug', $slug)
                ->orWhereRaw('LOWER(name) = ?', [$normalizedName])
                ->exists()
        ) {
            return $this->sendError('A product category with this name already exists.', 422, 'CATEGORY_EXISTS');
        }

        $validated['slug'] = $slug;
        $validated['is_active'] = $validated['is_active'] ?? true;

        $category = ProductCategory::create($validated);

        ActivityLog::log(
            $request->user()->id,
            'PRODUCT_CATEGORY_CREATED',
            'ProductCategory',
            $category->id,
            "Added product category: {$category->name}."
        );

        return $this->sendResponse($category, 'Product category created.', 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $category = ProductCategory::find($id);

        if (!$category) {
            return $this->sendError('Category not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'description' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        if (isset($validated['name'])) {
            $slug = Str::slug($validated['name']);
            $normalizedName = strtolower(trim($validated['name']));
            $duplicate = ProductCategory::where('id', '!=', $category->id)
                ->where(function ($q) use ($slug, $normalizedName) {
                    $q->where('slug', $slug)
                      ->orWhereRaw('LOWER(name) = ?', [$normalizedName]);
                })
                ->exists();
            if ($duplicate) {
                return $this->sendError('Another product category already uses this name.', 422, 'CATEGORY_EXISTS');
            }
            $validated['slug'] = $slug;
        }

        $category->update($validated);

        return $this->sendResponse($category, 'Product category updated.');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $category = ProductCategory::withCount('products')->find($id);

        if (!$category) {
            return $this->sendError('Category not found.', 404, 'NOT_FOUND');
        }

        if ($category->products_count > 0) {
            return $this->sendError(
                "Cannot delete category: {$category->products_count} active product offerings are assigned to it.",
                422,
                'CATEGORY_HAS_PRODUCTS'
            );
        }

        $category->delete();

        return $this->sendResponse(null, 'Category deleted successfully.');
    }
}
