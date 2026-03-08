import React from 'react';

import { Snackbar as MaterialSnackbar } from '@mui/material';
import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { Alert } from '../Alert';

import type { AlertType } from '../Alert/Alert';

interface SnackbarRequiredProps {
  open: boolean;
  handleClose: () => void;
  title: string;
}

interface SnackbarOptionalProps extends DefaultProps {
  // Snackbar props
  anchorOrigin?: { horizontal: 'center' | 'left' | 'right'; vertical: 'bottom' | 'top' };
  hideDuration?: number;
  key?: number | string;
  // Alert props
  alertClassName?: string;
  description?: string;
  type?: AlertType;
  actions?: React.ReactNode;
  headerAction?: () => void;
  headerActionLabel?: string;
}

export interface SnackbarProps extends SnackbarRequiredProps, SnackbarOptionalProps {}

const defaultProps: SnackbarOptionalProps = {
  'data-testid': 'tecma-snackbar',
};

const Snackbar = ({
  className,
  alertClassName,
  anchorOrigin = {
    vertical: 'bottom',
    horizontal: 'left',
  },
  open,
  handleClose,
  key,
  hideDuration,
  title,
  description,
  type,
  actions,
  headerAction,
  headerActionLabel,
  ...props
}: SnackbarProps) => {
  const classList = classNames('tecma-snackbar', className);
  const alertClassList = classNames(alertClassName);

  return (
    <MaterialSnackbar
      open={open}
      onClose={handleClose}
      autoHideDuration={hideDuration}
      className={classList}
      anchorOrigin={anchorOrigin}
      key={key}
      {...props}
    >
      <div>
        <Alert
          title={title}
          description={description}
          type={type}
          actions={actions}
          dismissable
          onDismiss={handleClose}
          className={alertClassList}
          headerAction={headerAction}
          headerActionLabel={headerActionLabel}
        />
      </div>
    </MaterialSnackbar>
  );
};

Snackbar.defaultProps = defaultProps as Partial<SnackbarProps>;

export default React.memo(Snackbar);
