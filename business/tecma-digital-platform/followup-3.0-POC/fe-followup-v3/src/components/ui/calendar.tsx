import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayPickerProps } from "react-day-picker";
import { it } from "date-fns/locale";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

import "react-day-picker/style.css";

export type CalendarProps = DayPickerProps;

/**
 * Calendario mensile (react-day-picker v9), stile allineato al DS (bordi, primary, oggi).
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = it,
  components,
  ...props
}: CalendarProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      {...props}
      showOutsideDays={showOutsideDays}
      locale={locale}
      className={cn("p-3", className)}
      classNames={{
        ...defaults,
        root: cn("w-fit", defaults.root),
        months: cn("relative flex flex-col gap-4 sm:flex-row", defaults.months),
        month: cn("flex w-full flex-col gap-4", defaults.month),
        month_caption: cn("relative mb-1 flex h-9 w-full items-center justify-center px-9", defaults.month_caption),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", defaults.nav),
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-8 w-8 bg-background p-0 opacity-80 hover:opacity-100",
          defaults.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-8 w-8 bg-background p-0 opacity-80 hover:opacity-100",
          defaults.button_next
        ),
        caption_label: cn("text-sm font-medium", defaults.caption_label),
        weekday: cn("text-muted-foreground w-9 text-center text-[0.75rem] font-normal", defaults.weekday),
        day: cn("relative p-0 text-center text-sm", defaults.day),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
          defaults.day_button
        ),
        selected: cn(
          "rounded-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          defaults.selected
        ),
        today: cn("rounded-md bg-muted text-foreground", defaults.today),
        outside: cn("text-muted-foreground opacity-50", defaults.outside),
        disabled: cn("text-muted-foreground opacity-40", defaults.disabled),
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chClass, orientation, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", chClass)} {...rest} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", chClass)} {...rest} />
          ),
        ...components,
      }}
    />
  );
}

export { Calendar };
