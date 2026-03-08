import React, { MouseEventHandler, ReactNode } from 'react';

import classNames from 'classnames';

import CardContainer from './CardContainer';
import CardContent from './CardContent';
import CardFooter from './CardFooter';
import CardHeader from './CardHeader';
import CardMedia from './CardMedia';
import CardTable from './CardTable';
import { DefaultProps } from '../../declarations/defaultProps';
import { Orientation } from '../../declarations/orientation';
// subcomponents

// styles
import '../../styles/card.scss';

// Required Props
interface CardRequiredProps {}
// Optional Props
interface CardOptionalProps extends DefaultProps {
  children?: ReactNode;
  fluid?: boolean;
  orientation?: Orientation;
  selected?: boolean;
  setSelected?: MouseEventHandler<HTMLDivElement>;
  borderLess?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface CardProps extends CardRequiredProps, CardOptionalProps {}
// use the optional prop interface to define the default props
const defaultProps: CardOptionalProps = {
  'data-testid': 'tecma-card',
  className: undefined,
  style: undefined,
  orientation: 'vertical',
  selected: false,
};

const Card: React.FC<CardProps> = ({ className, children, fluid, orientation, selected, setSelected, borderLess, ...rest }) => {
  const classList = classNames('tecma-card', { fluid }, { [`${orientation}`]: orientation }, { selected }, { borderLess }, className);
  return (
    <div aria-hidden='true' className={classList} onClick={setSelected} {...rest}>
      {children}
    </div>
  );
};

Card.defaultProps = defaultProps as Partial<CardOptionalProps>;

const CardSpace = Object.assign(Card, {
  Header: CardHeader,
  Footer: CardFooter,
  Content: CardContent,
  Media: CardMedia,
  Table: CardTable,
  Container: CardContainer,
});

export { CardSpace as Card };
