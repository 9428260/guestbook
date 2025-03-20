from langchain_ollama.llms import OllamaLLM
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

ollama_llm = OllamaLLM(base_url="http://52.79.90.51:11434", model="llama3.2:latest", callback_manager=CallbackManager([StreamingStdOutCallbackHandler()]))
ollama_llm.invoke("why is sky blue")