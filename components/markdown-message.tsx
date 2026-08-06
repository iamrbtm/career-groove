import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
        h1: ({ children }) => <h1 className="mb-1 mt-2 text-base font-black first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-1 mt-2 text-base font-black first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-black first:mt-0">{children}</h3>,
        h4: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-black first:mt-0">{children}</h4>,
        h5: ({ children }) => <h5 className="mb-1 mt-2 text-sm font-black first:mt-0">{children}</h5>,
        h6: ({ children }) => <h6 className="mb-1 mt-2 text-sm font-black first:mt-0">{children}</h6>,
        strong: ({ children }) => <strong className="font-black">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="my-1 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-1 list-decimal space-y-1 pl-5">{children}</ol>,
        li: ({ children }) => <li className="leading-6">{children}</li>,
        code: ({ className, children }) =>
          className ? (
            <code className="block overflow-x-auto rounded-2xl bg-ink/[0.06] p-3 font-mono text-xs leading-5">
              {children}
            </code>
          ) : (
            <code className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-xs">{children}</code>
          ),
        pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-coral underline decoration-coral/40 underline-offset-2"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-4 border-sun pl-3 text-ink/80">{children}</blockquote>
        ),
        hr: () => <hr className="my-2 border-ink/10" />,
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-ink/10 bg-ink/5 px-2 py-1 font-black text-left">{children}</th>
        ),
        td: ({ children }) => <td className="border border-ink/10 px-2 py-1">{children}</td>,
        input: (props) => (
          <input
            {...props}
            disabled
            className="mr-1.5 inline-block h-3.5 w-3.5 rounded-sm border border-ink/30 align-middle accent-mint"
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
