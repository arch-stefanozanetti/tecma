import React, { useRef } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { SizeStandard } from '../../declarations/size';
import { Icon } from '../Icon';
import { IconName } from '../Icon/IconName';
import { LazyImage } from '../LazyImage';

// styles
import '../../styles/avatar.scss';

// Required Props
interface AvatarRequiredProps {}

// Optional Props
interface AvatarOptionalProps extends DefaultProps {
  size?: SizeStandard;
  alt?: string;
  text?: string;
  src?: string;
  icon?: IconName;
}

// Combined required and optional props to build the full prop interface
export interface AvatarProps extends AvatarRequiredProps, AvatarOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: AvatarOptionalProps = {
  size: 'medium',
  'data-testid': 'tecma-avatar',
  alt: 'tecma-avatar-alternative',
};

/**
 * A graphical representation of a user: usually a photo, illustration, or initial.
 */
const Avatar: React.FC<AvatarProps> = ({ size, className, src, text, alt, icon, ...rest }) => {
  const classList = classNames('tecma-avatar', { [`${size}`]: size }, className);

  let childrenToRender: React.ReactNode;

  const avatarNodeRef = useRef<HTMLDivElement>(null);
  const avatarChildrenRef = useRef<HTMLSpanElement>(null);
  // const childrenScale = useScaleFactor(avatarNodeRef, avatarChildrenRef, 4, [text]);

  const imgExist = !!src;
  const iconNameExist = !!icon;
  const textExist = !!text;

  // const transformString = childrenScale ? `scale(${childrenScale})` : "";

  if (imgExist) {
    childrenToRender = <LazyImage.Image src={src} alt={alt} />;
  } else if (iconNameExist) {
    childrenToRender = <Icon className='avatar-icon' iconName={icon} size={size} />;
  } else if (textExist) {
    childrenToRender = <span ref={avatarChildrenRef}>{text}</span>;
  } else {
    childrenToRender = <span />;
  }

  return (
    <div ref={avatarNodeRef} className={classList} {...rest}>
      {childrenToRender}
    </div>
  );
};

Avatar.defaultProps = defaultProps as Partial<DefaultProps>;

export default React.memo(Avatar);
