export type State = {
  isLogin: boolean;
  name: string;
  email: string;
  password: string;
  cpassword: string;
};
export type Action =
  | { type: 'TOGGLE_MODE' }
  | { type: 'SET'; field: keyof Omit<State, 'isLogin'>; value: string };

export  interface UserFormData {
    name?: string;
    email: string;
    password: string;
    cpassword?: string;
}

export interface SigninFormData {
    email: string;
    password: string;
}