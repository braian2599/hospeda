'use client';

// Dibuja la respuesta del asistente.
//
// No usa dangerouslySetInnerHTML ni ninguna librería de Markdown: recibe la
// estructura ya parseada y arma elementos de React. El texto que escribe el
// modelo entra como contenido, nunca como marcado, así que no hay forma de que
// termine ejecutando algo en la pantalla del hotel.

import { Fragment } from 'react';
import { aBloques, type Trozo } from '@/lib/ai/formato';

function Partes({ partes }: { partes: Trozo[] }) {
  return (
    <>
      {partes.map((p, i) => {
        if (p.tipo === 'fuerte') return <strong key={i} className="font-semibold">{p.texto}</strong>;
        if (p.tipo === 'suave') return <em key={i}>{p.texto}</em>;
        if (p.tipo === 'codigo') {
          return (
            <code key={i} className="rounded bg-background/80 px-1 py-0.5 font-mono text-[12px]">
              {p.texto}
            </code>
          );
        }
        return <Fragment key={i}>{p.texto}</Fragment>;
      })}
    </>
  );
}

export default function TextoFormateado({ texto }: { texto: string }) {
  const bloques = aBloques(texto);

  return (
    <div className="flex flex-col gap-2">
      {bloques.map((b, i) => {
        if (b.tipo === 'titulo') {
          // Dentro de una burbuja de chat un <h2> quedaría enorme y además
          // rompería el orden de encabezados de la página. Se resuelve con
          // peso, no con jerarquía.
          return <p key={i} className="font-semibold"><Partes partes={b.partes} /></p>;
        }

        if (b.tipo === 'lista') {
          const Lista = b.ordenada ? 'ol' : 'ul';
          return (
            <Lista
              key={i}
              start={b.ordenada ? b.desde : undefined}
              className={`flex flex-col gap-1 pl-5 ${b.ordenada ? 'list-decimal' : 'list-disc'} marker:text-muted-foreground`}
            >
              {b.items.map((item, j) => <li key={j}><Partes partes={item} /></li>)}
            </Lista>
          );
        }

        return (
          <p key={i}>
            {b.lineas.map((linea, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Partes partes={linea} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
