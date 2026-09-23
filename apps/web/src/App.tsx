import { useEffect, useRef, useState } from 'react';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Model = {
  id: string;
  name: string;
  provider: string;
  thinking: {
    supported: boolean;
  };
};

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const [models, setModels] = useState<Model[]>([]);

  const [model, setModel] = useState<Model['id']>();
  const [think, setThink] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);

  const loadModels = async () => {
    try {
      const response = await fetch(`${API_URL}/models`);

      if (!response.ok) {
        throw new Error(`Failed to load models: ${response.status}`);
      }

      const data = await response.json();

      setModels(data);
      setModel(data[0].id);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const sendMessage = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isStreaming) {
      return;
    }

    setMessage('');
    setIsStreaming(true);

    const controller = new AbortController();
    controllerRef.current = controller;

    const userMessage: Message = {
      role: 'user',
      content: trimmedMessage,
    };

    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
    };

    const nextMessages = [...messages, userMessage, assistantMessage];

    setMessages(nextMessages);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          model,
          think,
          input: [...messages, userMessage],
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        for (const event of value.split('\n\n')) {
          if (!event.startsWith('data:')) {
            continue;
          }

          const data = event.slice(5).trim();

          if (data === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.type !== 'response.output_text.delta') {
              continue;
            }

            const content = parsed.delta;

            if (!content) {
              continue;
            }

            setMessages((previous) => {
              const updated = [...previous];
              const last = updated.length - 1;

              if (updated[last]?.role === 'assistant') {
                updated[last] = {
                  ...updated[last],
                  content: updated[last].content + content,
                };
              }

              return updated;
            });
          } catch (error) {
            console.error('Failed to parse SSE:', data, error);
          }
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        console.log('Request aborted');
        return;
      }

      console.error(error);

      setMessages((previous) => {
        const updated = [...previous];
        const last = updated.length - 1;

        if (updated[last]?.role === 'assistant') {
          updated[last] = {
            role: 'assistant',
            content: 'Something went wrong.',
          };
        }

        return updated;
      });
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }

      setIsStreaming(false);
    }
  };

  const abort = () => {
    controllerRef.current?.abort();
  };

  useEffect(() => {
    loadModels();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        <div>
          Model:{' '}
          <select
            value={model}
            disabled={isStreaming}
            onChange={(event) => setModel(event.target.value)}
          >
            {models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          Think:{' '}
          {models.find((item) => item.id === model)?.thinking.supported ? (
            <button
              disabled={isStreaming}
              onClick={() => setThink((previous) => !previous)}
            >
              Think: {think ? 'on' : 'off'}
            </button>
          ) : (
            <span>Not supported</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', gap: '15px' }}>
        {messages.map((item, index) => (
          <div
            key={index}
            style={{
              marginBottom: '20px',
              backgroundColor: item.role === 'user' ? '' : 'lightblue',
              padding: '10px',
              borderRadius: '5px',
            }}
          >
            <strong>{item.role === 'user' ? 'You' : 'AI'}</strong>

            <Markdown remarkPlugins={[remarkGfm]}>{item.content}</Markdown>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginTop: '20px',
        }}
      >
        <input
          type="text"
          value={message}
          disabled={isStreaming}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }}
        />

        <button disabled={isStreaming || !message.trim()} onClick={sendMessage}>
          Send
        </button>

        {isStreaming && (
          <button onClick={abort} style={{ backgroundColor: 'red' }}>
            Abort
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
