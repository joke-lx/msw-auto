# MSW Auto Docker 配置

## 快速开始

```bash
# 构建镜像
docker build -t msw-auto .

# 运行容器
docker run -d \
  -p 3001:3001 \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e ANTHROPIC_API_KEY=your-api-key \
  msw-auto
```

## 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `PORT` | 3001 | Mock 服务器端口 |
| `WEB_PORT` | 3000 | Web UI 端口 |
| `DB_PATH` | ./data/mocks.db | 数据库路径 |
| `ANTHROPIC_API_KEY` | - | Claude API Key |
| `BACKEND_URL` | - | 后端代理地址 |

## Docker Compose

```yaml
version: '3.8'

services:
  msw-auto:
    build: .
    ports:
      - "3001:3001"  # Mock server
      - "3000:3000"  # Web UI
    volumes:
      - ./data:/app/data
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - BACKEND_URL=http://host.docker.internal:8080
    restart: unless-stopped
```

运行:
```bash
docker-compose up -d
```

## 开发模式

```bash
# 使用 Dockerfile.dev 进行热重载开发
docker build -f Dockerfile.dev -t msw-auto:dev .
docker run -it -p 3001:3001 -p 3000:3000 -v $(pwd):/app msw-auto:dev
```
