export function HtmlPreview({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
