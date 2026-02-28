/**
 * Mock Data Generator
 *
 * Uses AI to generate mock data for API endpoints
 */
/**
 * Generate mock data for API endpoints using AI
 */
export async function generateMockData(projectPath, endpoints) {
    const mocks = [];
    for (const endpoint of endpoints) {
        const mock = await generateSingleMock(endpoint);
        mocks.push(mock);
    }
    return mocks;
}
/**
 * Generate mock data for a single endpoint
 */
async function generateSingleMock(endpoint) {
    // Generate realistic mock data based on the endpoint path and method
    const mockData = generateBasedOnPath(endpoint);
    return {
        method: endpoint.method,
        path: endpoint.path,
        status: getDefaultStatus(endpoint.method),
        response: mockData,
        headers: {
            'Content-Type': 'application/json',
        },
        delay: Math.floor(Math.random() * 500), // Random delay 0-500ms
    };
}
/**
 * Generate mock data based on the API path
 */
function generateBasedOnPath(endpoint) {
    const path = endpoint.path.toLowerCase();
    const method = endpoint.method.toLowerCase();
    // User related endpoints
    if (path.includes('user') || path.includes('auth') || path.includes('login')) {
        return generateUserMock(path, method);
    }
    // Product/E-commerce endpoints
    if (path.includes('product') || path.includes('item') || path.includes('goods')) {
        return generateProductMock(path, method);
    }
    // Order endpoints
    if (path.includes('order') || path.includes('transaction')) {
        return generateOrderMock(path, method);
    }
    // List/Collection endpoints
    if (path.includes('list') || path.endsWith('s') || path.endsWith('es')) {
        return generateListMock(path, method);
    }
    // CRUD operations
    if (method === 'post' || path.includes('create')) {
        return { success: true, id: generateId(), message: 'Created successfully' };
    }
    if (method === 'put' || method === 'patch' || path.includes('update')) {
        return { success: true, message: 'Updated successfully' };
    }
    if (method === 'delete' || path.includes('delete')) {
        return { success: true, message: 'Deleted successfully' };
    }
    // Default response
    return {
        success: true,
        data: {
            id: generateId(),
            message: 'Operation successful',
            timestamp: new Date().toISOString(),
        },
    };
}
function generateUserMock(path, method) {
    if (method === 'post' || path.includes('login') || path.includes('auth')) {
        return {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: {
                id: generateId(),
                username: 'john_doe',
                email: 'john@example.com',
                role: 'user',
            },
        };
    }
    if (path.includes('register') || path.includes('signup')) {
        return {
            success: true,
            user: {
                id: generateId(),
                username: 'john_doe',
                email: 'john@example.com',
            },
        };
    }
    if (path.includes('profile')) {
        return {
            id: generateId(),
            username: 'john_doe',
            email: 'john@example.com',
            avatar: 'https://example.com/avatar.jpg',
            bio: 'Software developer',
            createdAt: '2024-01-01T00:00:00Z',
        };
    }
    return {
        users: Array.from({ length: 10 }, (_, i) => ({
            id: generateId(),
            username: `user_${i + 1}`,
            email: `user${i + 1}@example.com`,
            role: i === 0 ? 'admin' : 'user',
        })),
        total: 100,
        page: 1,
        pageSize: 10,
    };
}
function generateProductMock(path, method) {
    if (method === 'post' || path.includes('create')) {
        return {
            success: true,
            product: {
                id: generateId(),
                name: 'New Product',
                price: 99.99,
            },
        };
    }
    if (path.includes('category') || path.includes('list')) {
        return {
            products: Array.from({ length: 20 }, (_, i) => ({
                id: generateId(),
                name: `Product ${i + 1}`,
                price: (Math.random() * 1000).toFixed(2),
                category: ['Electronics', 'Clothing', 'Books', 'Food'][i % 4],
                inStock: Math.random() > 0.3,
            })),
            total: 100,
        };
    }
    return {
        id: generateId(),
        name: 'Sample Product',
        description: 'This is a sample product description',
        price: 99.99,
        category: 'Electronics',
        images: [
            'https://example.com/image1.jpg',
            'https://example.com/image2.jpg',
        ],
        inStock: true,
        rating: (Math.random() * 2 + 3).toFixed(1),
        reviews: Math.floor(Math.random() * 100),
    };
}
function generateOrderMock(path, method) {
    if (method === 'post' || path.includes('create')) {
        return {
            success: true,
            order: {
                id: generateId(),
                status: 'pending',
                total: 299.99,
                items: [
                    { productId: generateId(), quantity: 2, price: 99.99 },
                    { productId: generateId(), quantity: 1, price: 100.01 },
                ],
            },
        };
    }
    if (path.includes('status')) {
        return {
            orderId: generateId(),
            status: 'shipped',
            trackingNumber: 'TRACK' + Math.random().toString(36).substring(7).toUpperCase(),
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        };
    }
    return {
        orders: Array.from({ length: 10 }, (_, i) => ({
            id: generateId(),
            status: ['pending', 'processing', 'shipped', 'delivered'][i % 4],
            total: (Math.random() * 500).toFixed(2),
            createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        })),
        total: 50,
    };
}
function generateListMock(path, method) {
    const resourceName = path.split('/').filter(Boolean).pop() || 'items';
    return {
        [resourceName]: Array.from({ length: 20 }, (_, i) => ({
            id: generateId(),
            name: `${resourceName.slice(0, -1)} ${i + 1}`,
            createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        })),
        total: 100,
        page: 1,
        pageSize: 20,
    };
}
function generateId() {
    return Math.random().toString(36).substring(2, 15);
}
function getDefaultStatus(method) {
    const statusMap = {
        get: 200,
        post: 201,
        put: 200,
        patch: 200,
        delete: 204,
    };
    return statusMap[method.toLowerCase()] || 200;
}
