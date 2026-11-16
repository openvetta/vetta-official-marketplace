export function ImageBlock({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
    return (
        <figure>
            <img src={src} alt={alt} loading="lazy" className="max-h-[420px] w-full rounded-xl object-contain" />
            {caption ? <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">{caption}</figcaption> : null}
        </figure>
    );
}
