<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductController extends BaseApiController
{
    /**
     * Resolve canonical Product enum code from explicit value or category taxonomy.
     */
    private function resolveProductCategory(?string $explicitCode, ?int $categoryId, string $fallback = 'CUSTOM_GIFT'): string
    {
        $allowed = ['PHOTO_FRAME', 'MAGAZINE_ALBUM', 'GIFT_HAMPER', 'CUSTOM_GIFT'];
        if ($explicitCode && in_array($explicitCode, $allowed, true)) {
            return $explicitCode;
        }

        if ($categoryId) {
            $cat = ProductCategory::find($categoryId);
            if ($cat) {
                $haystack = strtolower(($cat->slug ?? '') . ' ' . ($cat->name ?? ''));
                if (str_contains($haystack, 'frame')) {
                    return 'PHOTO_FRAME';
                }
                if (str_contains($haystack, 'album') || str_contains($haystack, 'magazine')) {
                    return 'MAGAZINE_ALBUM';
                }
                if (str_contains($haystack, 'hamper') || str_contains($haystack, 'box')) {
                    return 'GIFT_HAMPER';
                }
            }
        }

        return $fallback;
    }

    public function index(Request $request): JsonResponse
    {
        $query = Product::with('categoryRef');

        // Include archived if requested
        if (filter_var($request->query('include_archived'), FILTER_VALIDATE_BOOLEAN)) {
            $query->withTrashed();
        }

        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }

        if ($categoryId = $request->query('category_id')) {
            $query->where('category_id', $categoryId);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $products = $query->orderBy('name')->paginate($request->query('per_page', 25));

        return $this->sendResponse($products->items(), null, 200, [
            'current_page' => $products->currentPage(),
            'per_page' => $products->perPage(),
            'total' => $products->total(),
            'last_page' => $products->lastPage(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => 'required_without:category|nullable|exists:product_categories,id',
            'name' => 'required|string|max:200',
            'category' => 'required_without:category_id|nullable|in:PHOTO_FRAME,MAGAZINE_ALBUM,GIFT_HAMPER,CUSTOM_GIFT',
            'base_price' => 'required|numeric|min:0',
            'description' => 'nullable|string',
            'image_url' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
        ]);

        $validated['category'] = $this->resolveProductCategory(
            $validated['category'] ?? null,
            isset($validated['category_id']) ? (int)$validated['category_id'] : null
        );
        $validated['is_active'] = $validated['is_active'] ?? true;
        $product = Product::create($validated);

        ActivityLog::log(
            $request->user()->id,
            'PRODUCT_CREATED',
            'Product',
            $product->id,
            "Added base craft offering: {$product->name} (INR {$product->base_price})."
        );

        return $this->sendResponse($product->load('categoryRef'), 'Product created successfully.', 201);
    }

    public function show(int $id): JsonResponse
    {
        $product = Product::withTrashed()->with(['categoryRef', 'orderItems'])->find($id);

        if (!$product) {
            return $this->sendError('Product offering not found.', 404, 'NOT_FOUND');
        }

        return $this->sendResponse($product);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $product = Product::withTrashed()->find($id);

        if (!$product) {
            return $this->sendError('Product offering not found.', 404, 'NOT_FOUND');
        }

        $validated = $request->validate([
            'category_id' => 'nullable|exists:product_categories,id',
            'name' => 'sometimes|required|string|max:200',
            'category' => 'sometimes|nullable|in:PHOTO_FRAME,MAGAZINE_ALBUM,GIFT_HAMPER,CUSTOM_GIFT',
            'base_price' => 'sometimes|required|numeric|min:0',
            'description' => 'nullable|string',
            'image_url' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
        ]);

        if (array_key_exists('category', $validated) || array_key_exists('category_id', $validated)) {
            $validated['category'] = $this->resolveProductCategory(
                $validated['category'] ?? null,
                array_key_exists('category_id', $validated)
                    ? ($validated['category_id'] ? (int)$validated['category_id'] : null)
                    : $product->category_id,
                $product->category ?? 'CUSTOM_GIFT'
            );
        }

        $oldValues = $product->toArray();
        $product->update($validated);

        ActivityLog::log(
            $request->user()->id,
            'PRODUCT_UPDATED',
            'Product',
            $product->id,
            "Updated catalogue offering {$product->name}.",
            $oldValues,
            $product->toArray()
        );

        return $this->sendResponse($product->load('categoryRef'), 'Product updated successfully.');
    }

    /**
     * Archive / soft-delete a product offering.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $product = Product::find($id);

        if (!$product) {
            return $this->sendError('Product offering not found or already archived.', 404, 'NOT_FOUND');
        }

        $product->delete();

        ActivityLog::log(
            $request->user()->id,
            'PRODUCT_ARCHIVED',
            'Product',
            $id,
            "Archived product offering: {$product->name}."
        );

        return $this->sendResponse(null, 'Product archived successfully.');
    }

    /**
     * Restore an archived product offering.
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        $product = Product::onlyTrashed()->find($id);

        if (!$product) {
            return $this->sendError('Archived product offering not found.', 404, 'NOT_FOUND');
        }

        $product->restore();

        ActivityLog::log(
            $request->user()->id,
            'PRODUCT_RESTORED',
            'Product',
            $id,
            "Restored product offering: {$product->name}."
        );

        return $this->sendResponse($product, 'Product unarchived successfully.');
    }

    /**
     * Upload an image asset for product offerings.
     */
    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:5120', // max 5MB
        ]);

        $file = $request->file('image');
        $ext = strtolower($file->getClientOriginalExtension());
        $filename = 'product_' . time() . '_' . Str::random(8) . '.' . $ext;
        $file->storeAs('products', $filename, 'public');

        $url = '/api/v1/products/images/' . $filename;

        return $this->sendResponse([
            'url' => $url,
            'filename' => $filename,
        ], 'Image uploaded successfully.');
    }

    /**
     * Serve uploaded product catalog image cleanly across proxied & split origins.
     */
    public function showImage(string $filename): StreamedResponse|JsonResponse
    {
        $safeName = basename($filename);
        if (!preg_match('/^product_[0-9]+_[A-Za-z0-9]+\.(jpeg|jpg|png|webp)$/i', $safeName)) {
            return $this->sendError('Invalid image filename.', 400, 'INVALID_FILENAME');
        }

        $storagePath = 'products/' . $safeName;
        if (!Storage::disk('public')->exists($storagePath)) {
            return $this->sendError('Product image not found.', 404, 'NOT_FOUND');
        }

        return Storage::disk('public')->response($storagePath, $safeName, [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
