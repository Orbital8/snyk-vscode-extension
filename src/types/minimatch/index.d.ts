declare namespace minimatch {
  interface IOptions {
    debug?: boolean | undefined;
    nobrace?: boolean | undefined;
    noglobstar?: boolean | undefined;
    dot?: boolean | undefined;
    noext?: boolean | undefined;
    nocase?: boolean | undefined;
    nonull?: boolean | undefined;
    matchBase?: boolean | undefined;
    nocomment?: boolean | undefined;
    nonegate?: boolean | undefined;
    flipNegate?: boolean | undefined;
    partial?: boolean | undefined;
    windowsPathsNoEscape?: boolean | undefined;
    allowWindowsEscape?: boolean | undefined;
  }

  interface IMinimatch {
    pattern: string;
    options: IOptions;
    set: string[][];
    regexp: RegExp | false | null;
    negate: boolean;
    comment: boolean;
    empty: boolean;
    makeRe(): RegExp | false;
    match(path: string, partial?: boolean): boolean;
  }
}

declare function minimatch(target: string, pattern: string, options?: minimatch.IOptions): boolean;

declare namespace minimatch {
  function filter(pattern: string, options?: IOptions): (element: string, index: number, array: readonly string[]) => boolean;
  function braceExpand(pattern: string, options?: IOptions): string[];
  function makeRe(pattern: string, options?: IOptions): RegExp | false;
  function match(list: readonly string[], pattern: string, options?: IOptions): string[];
  function defaults(options: IOptions): typeof minimatch;

  class Minimatch implements IMinimatch {
    constructor(pattern: string, options?: IOptions);
    pattern: string;
    options: IOptions;
    set: string[][];
    regexp: RegExp | false | null;
    negate: boolean;
    comment: boolean;
    empty: boolean;
    makeRe(): RegExp | false;
    match(path: string, partial?: boolean): boolean;
  }
}

export = minimatch;
