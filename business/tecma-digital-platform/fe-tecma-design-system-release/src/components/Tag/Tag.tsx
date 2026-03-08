import React, { SyntheticEvent } from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { IconName } from '../Icon/IconName';

// styles
import '../../styles/tag.scss';

// Required Props
interface TagRequiredProps {
  // The tag label
  label: string;
}

// Optional Props
interface TagOptionalProps extends DefaultProps {
  // The close icon
  dismissableIcon?: IconName;
  // The action to perform on close icon click
  onDismissableIconClick?: () => void;
  // If true, the tag is dismissable
  dismissable?: boolean;
  // If true, the tag is disabled
  disabled?: boolean;
  // The tag icon
  iconName?: IconName;
  onTagClick?: () => void;
}

// Combined required and optional props to build the full prop interface
export interface TagProps extends TagRequiredProps, TagOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: TagOptionalProps = {
  'data-testid': 'tecma-tag',
  dismissableIcon: 'x',
  dismissable: false,
  disabled: false,
};

/**
 * A small label, generally appearing inside or in close proximity to another larger interface component, representing a status, property, or some other metadata.
 */
const Tag: React.FC<TagProps> = ({
  label,
  iconName,
  dismissableIcon,
  onDismissableIconClick,
  dismissable,
  disabled,
  className,
  onTagClick,
  ...rest
}) => {
  const classList = classNames('tecma-tag', { disabled }, { dismissable }, className);
  const Wrapper = onTagClick ? Button : 'div';
  const handleOnDismissClick = (e: SyntheticEvent) => {
    if (onDismissableIconClick) {
      onDismissableIconClick();
      /**
       * Useful to avoid triggering some other event (e.g. Select component with multiple selection will trigger the select itself to open/close when dismissing tags)
       */
      e.stopPropagation();
    }
  };

  return (
    <Wrapper
      onClick={onTagClick as React.MouseEventHandler<HTMLButtonElement> & React.MouseEventHandler<HTMLDivElement>}
      className={classList}
      {...rest}
    >
      {iconName && <Icon iconName={iconName} size='small' />}
      <span>{label}</span>
      {dismissable && <Button iconName={dismissableIcon} onClick={(e) => handleOnDismissClick(e)} size='small' color='transparent' />}
    </Wrapper>
  );
};

Tag.defaultProps = defaultProps as Partial<TagOptionalProps>;

export default React.memo(Tag);
