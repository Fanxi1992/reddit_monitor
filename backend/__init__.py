"""
backend 包初始化文件。

当前阶段主要作用：
1. 让 backend 目录成为一个标准 Python 包。
2. 便于后续使用 `uvicorn backend.main:app --reload` 方式启动项目。
3. 方便未来拆分 routers、services、tasks 等模块时使用绝对导入。
"""
