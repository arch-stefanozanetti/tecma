import React, { MouseEventHandler } from "react";
import classNames from "classnames";

import { Colors } from "../../declarations/colors";
import { DefaultProps } from "../../declarations/defaultProps";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { IconName } from "../Icon/IconName";

// styles
import '../../styles/alert.scss';

// Required Props
interface AlertRequiredProps {
  // The alert title
  title: string;
}

export type AlertTypeWithIcon = "success" | "warning" | "error" | "informative" | "primary";
export type AlertType = "default" | "primary" | AlertTypeWithIcon;

// Optional Props
interface AlertOptionalProps extends DefaultProps {
  // The alert description
  description?: string;
  // The alert actions
  actions?: React.ReactNode;
  // The alert header actions
  headerAction?: MouseEventHandler;
  headerActionLabel?: string;
  // The alert type, could be 'default', 'success', 'warning', 'error' and 'informative'
  type?: AlertType;
  // Defines if the alert is dismissable or not
  dismissable?: boolean;
  // The callback to perform on dismiss
  onDismiss?: MouseEventHandler;
  // The alert content direction
  contentDirection?: 'horizontal' | 'vertical';
}

// Combined required and optional props to build the full prop interface
export interface AlertProps extends AlertRequiredProps, AlertOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: AlertOptionalProps = {
  'data-testid': 'tecma-alert',
  type: 'default',
  dismissable: false,
};

const iconType: { [key in AlertTypeWithIcon]: IconName } = {
  success: 'check-circle',
  warning: 'exclamation',
  error: 'x-circle',
  informative: 'information-circle',
  primary: 'sparkles',
};

const headerActionColor: { [key in AlertTypeWithIcon]: Colors } = {
  success: "success",
  warning: "warning",
  error: "danger",
  informative: "info",
  primary: "primary",
};

const Alert: React.FC<AlertProps> = ({
  title,
  description,
  actions,
  headerAction,
  headerActionLabel,
  type,
  dismissable,
  onDismiss,
  contentDirection = 'vertical',
  className,
  ...rest
}) => {
  const classList = classNames('tecma-alert', { [`${type}`]: type }, { dismissable }, className);
  const classListTitle = classNames("alert-title", {
    "with-action": headerAction && headerActionLabel,
    "with-dismissable": dismissable && onDismiss,
    "with-icon": type && type !== "default",
  });
  const classListAlertContent = classNames("alert-content", {
    [`${contentDirection}`]: contentDirection,
  });
  return (
    <div className={classList} {...rest}>
      <div className="alert-container">
        <div className="alert-header">
          {type && type !== "default" && iconType[type] && <Icon iconName={iconType[type]} />}
          <h4 className={classListTitle}>
            {title}
            {headerAction && headerActionLabel && (
              <Button
                onClick={headerAction}
                className="alert-header-action"
                link
                color={headerActionColor[type === "default" ? "primary" : type ?? "primary"]}
                size="small"
              >
                {headerActionLabel}
              </Button>
            )}
          </h4>
          {dismissable && onDismiss && (
            <Button
              className="alert-dismiss-button"
              onClick={onDismiss}
              iconName="x"
              color="transparent"
            />
          )}
        </div>
        {(description || actions) && (
          <div className={classListAlertContent}>
            {description && (
              // eslint-disable-next-line react/no-danger
              <p className="alert-description" dangerouslySetInnerHTML={{ __html: description }} />
            )}
            {actions && <div className="alert-actions"> {actions}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

Alert.defaultProps = defaultProps as Partial<AlertOptionalProps>;

/**
 * A way of informing the user of important changes in a prominent way.
 */
export default React.memo(Alert);
