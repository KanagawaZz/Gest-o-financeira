import { useTheme } from '@/app/providers/ThemeProvider'
import c1280avif from '@/assets/fundo/cidade-1280.avif'
import c1280webp from '@/assets/fundo/cidade-1280.webp'
import c1920avif from '@/assets/fundo/cidade-1920.avif'
import c1920webp from '@/assets/fundo/cidade-1920.webp'
import c2560avif from '@/assets/fundo/cidade-2560.avif'
import c2560webp from '@/assets/fundo/cidade-2560.webp'
import celularAvif from '@/assets/fundo/cidade-celular-580.avif'
import celularWebp from '@/assets/fundo/cidade-celular-580.webp'
import tabletAvif from '@/assets/fundo/cidade-tablet-941.avif'
import tabletWebp from '@/assets/fundo/cidade-tablet-941.webp'

/*
 * Fotografia de fundo (Ponte Estaiada, 2560×1255 no original) como <img> independente atrás do conteúdo,
 * com object-fit: cover e ponto focal no mastro da ponte. Nada de background-attachment: fixed.
 *
 * Enquadramentos (todos na resolução nativa da foto, nunca ampliados no arquivo):
 *  - celular em pé: recorte vertical 580×1255 centrado no mastro;
 *  - tablet em pé: recorte 3:4 941×1255;
 *  - telas deitadas (notebook, Full HD, 2K, 4K): a foto inteira em 1280/1920/2560 px.
 * `sizes`: com cover, a foto (2,04:1) é dimensionada pela ALTURA em telas 16:9; a largura renderizada é
 * max(100vw, 204vh). Declarar isso faz o navegador escolher o arquivo certo em vez de ampliar um menor.
 *
 * Só existe no tema cidade: o tema azul é plano (fundo branco) e nem baixa a foto.
 */
const LANDSCAPE_SIZES = 'max(100vw, 204vh)'
const landscapeAvif = `${c1280avif} 1280w, ${c1920avif} 1920w, ${c2560avif} 2560w`
const landscapeWebp = `${c1280webp} 1280w, ${c1920webp} 1920w, ${c2560webp} 2560w`
const PHONE = '(max-width: 600px) and (orientation: portrait)'
const TABLET = '(max-width: 1100px) and (orientation: portrait)'

export function Backdrop() {
  if (useTheme().style === 'azul') return null
  return (
    <div aria-hidden className="backdrop">
      <picture>
        <source media={PHONE} type="image/avif" srcSet={`${celularAvif} 580w`} sizes="100vw" />
        <source media={PHONE} type="image/webp" srcSet={`${celularWebp} 580w`} sizes="100vw" />
        <source media={TABLET} type="image/avif" srcSet={`${tabletAvif} 941w`} sizes="100vw" />
        <source media={TABLET} type="image/webp" srcSet={`${tabletWebp} 941w`} sizes="100vw" />
        <source type="image/avif" srcSet={landscapeAvif} sizes={LANDSCAPE_SIZES} />
        <img
          className="backdrop-img"
          src={c1920webp}
          srcSet={landscapeWebp}
          sizes={LANDSCAPE_SIZES}
          alt=""
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
      </picture>
      {/* Camada independente entre a foto e a interface: escurece só onde há texto, sem lavar a imagem. */}
      <div className="backdrop-overlay" />
    </div>
  )
}
