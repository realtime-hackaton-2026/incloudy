import brasil from "../assets/avatar/brasil.webp";
import chileno from "../assets/avatar/chileno.webp";
import colombiano from "../assets/avatar/colombiano.webp";
import gaucho from "../assets/avatar/gaucho.webp";
import joven from "../assets/avatar/joven.webp";
import moderno from "../assets/avatar/moderno.webp";
import paraguayo from "../assets/avatar/paraguayo.webp";
import peruano from "../assets/avatar/peruano.webp";
import tradicional from "../assets/avatar/tradicional.webp";

// Catálogo de avatares jugables. Para añadir uno nuevo: cae la imagen en
// src/assets/avatar/, se importa aquí y se agrega una entrada — AvatarBar y
// el sprite del mapa lo recogen automáticamente, sin tocar nada más.
export const AVATARS = [
  { id: "gaucho", name: "Gaucho", src: gaucho },
  { id: "brasil", name: "Brasil", src: brasil },
  { id: "chileno", name: "Chileno", src: chileno },
  { id: "colombiano", name: "Colombiano", src: colombiano },
  { id: "peruano", name: "Peruano", src: peruano },
  { id: "paraguayo", name: "Paraguayo", src: paraguayo },
  { id: "tradicional", name: "Tradicional", src: tradicional },
  { id: "joven", name: "Joven", src: joven },
  { id: "moderno", name: "Moderno", src: moderno },
];

export const DEFAULT_AVATAR_ID = AVATARS[0].id;

export function getAvatarById(id) {
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
}
