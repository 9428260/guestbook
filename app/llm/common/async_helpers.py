#!/usr/bin/env python3
"""
비동기 처리를 위한 헬퍼 함수들
"""

import asyncio
from typing import AsyncGenerator

class SafeAsyncGenerator:
    """안전한 비동기 제너레이터 래퍼"""
    
    def __init__(self, async_gen: AsyncGenerator):
        self.async_gen = async_gen
        self._closed = False
    
    async def __anext__(self):
        if self._closed:
            raise StopAsyncIteration
        return await self.async_gen.__anext__()
    
    async def aclose(self):
        if not self._closed:
            self._closed = True
            if hasattr(self.async_gen, 'aclose'):
                await self.async_gen.aclose()
    
    def __aiter__(self):
        return self

def setup_nested_event_loop():
    """중첩 이벤트 루프 설정"""
    # Python 3.14에서 nest_asyncio와 anyio의 CancelScope가 충돌하므로
    # 매 요청마다 독립적인 이벤트 루프를 생성해 사용한다.
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # sniffio가 비동기 라이브러리를 감지하지 못하는 문제를 방지
    try:
        import sniffio
        sniffio.current_async_library_cvar.set("asyncio")
    except ImportError:
        print("Warning: sniffio not available")
    except Exception as exc:
        print(f"Warning: failed to set sniffio context ({exc})")
    
    return loop
