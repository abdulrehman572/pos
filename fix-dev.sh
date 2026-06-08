#!/bin/bash
# fix-dev.sh – Restore missing files and dependencies for Kiryana POS
# Run this inside ~/kiryana-app

set -e

echo "🔧 Fixing Kiryana development environment..."

# 1. Ensure we are in the correct folder
if [ ! -f "package.json" ]; then
    echo "📦 No package.json found. Initializing Bun project..."
    bun init -y
fi

# 2. Install missing dependencies (idempotent)
echo "📦 Installing/updating dependencies..."
bun add elysia drizzle-orm @elysiajs/static
bun add -d drizzle-kit tailwindcss @types/bun

# 3. Create required folders
mkdir -p backend/src frontend/css

# 4. Create backend entry point if missing
if [ ! -f "backend/src/index.ts" ]; then
    echo "📝 Creating backend/src/index.ts"
    cat > backend/src/index.ts << 'EOF'
import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';

const app = new Elysia()
  .use(staticPlugin({ assets: './frontend', prefix: '' }))
  .get('/api/health', () => ({ status: 'ok' }))
  .listen(3000);

console.log(`🦊 Elysia running at http://${app.server?.hostname}:${app.server?.port}`);
EOF
fi

# 5. Create Tailwind input CSS if missing
if [ ! -f "frontend/css/input.css" ]; then
    echo "🎨 Creating frontend/css/input.css"
    cat > frontend/css/input.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF
fi

# 6. Create index.html if missing
if [ ! -f "frontend/index.html" ]; then
    echo "📄 Creating frontend/index.html"
    cat > frontend/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kiryana POS</title>
    <link href="/css/output.css" rel="stylesheet">
</head>
<body class="bg-gray-100">
    <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold">Kiryana POS</h1>
        <p>Setup complete – ready for development.</p>
    </div>
</body>
</html>
EOF
fi

# 7. Generate initial Tailwind CSS output
echo "🎨 Building Tailwind CSS..."
bunx tailwindcss -i frontend/css/input.css -o frontend/css/output.css

# 8. Create the dev runner script (if missing)
if [ ! -f "dev.sh" ]; then
    echo "🚀 Creating dev.sh runner"
    cat > dev.sh << 'EOF'
#!/bin/bash
bunx tailwindcss -i frontend/css/input.css -o frontend/css/output.css --watch &
bun --watch backend/src/index.ts
EOF
    chmod +x dev.sh
fi

echo ""
echo "✅ Fix complete!"
echo ""
echo "▶️  Start the development server with:"
echo "   ./dev.sh"
echo ""
echo "🌐 Then open http://localhost:3000"