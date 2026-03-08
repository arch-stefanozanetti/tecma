import React from 'react';

export interface CarouselState {
  itemListStyle?: React.CSSProperties;
  slideStyle?: React.CSSProperties;
  selectedStyle?: React.CSSProperties;
  prevStyle?: React.CSSProperties;
}

export interface AnimationHandlerResponse {
  itemListStyle?: React.CSSProperties;
  slideStyle?: React.CSSProperties;
  selectedStyle?: React.CSSProperties;
  prevStyle?: React.CSSProperties;
}

export interface SliderOptions {
  selectedItem: number;
  totalItems: number;
  spaceBetween: number;
  slidePerView: number;
}
