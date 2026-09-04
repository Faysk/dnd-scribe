import Image from 'next/image'

type ArtworkImageProps = Readonly<{
  src: string
  alt: string
  sizes: string
  className?: string
  priority?: boolean
}>

export function ArtworkImage({ alt, className, priority = false, sizes, src }: ArtworkImageProps) {
  return (
    <Image
      alt={alt}
      className={className}
      fill
      priority={priority}
      sizes={sizes}
      src={src}
    />
  )
}
