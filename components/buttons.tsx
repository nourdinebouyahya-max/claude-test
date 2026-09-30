"use client";

import { Plus, Pencil, KeyRound, ArrowLeftRight, Megaphone, Wallet, CreditCard, UserPlus, Landmark, Receipt } from "lucide-react";
import { ModalButton } from "./client";
import {
  AccountRequestForm, ClientForm, ExpenseForm, ManagerForm, MethodForm, PaymentForm, ReassignForm, ResetPasswordForm, TopupForm,
  type ClientInit, type MethodOpt,
} from "./forms";

type Pricing = Record<string, { price: number; fee: number }>;
type ClientOpt = { id: number; business_name: string };
type M = { id: number; name: string };

export function NewClientButton({ managers, goTo }: { managers?: M[]; goTo: string }) {
  return <ModalButton label="Add client" icon={<Plus />} title="Add client" render={(close) => <ClientForm managers={managers} onDone={close} goTo={goTo} />} />;
}

export function EditClientButton({ initial }: { initial: ClientInit }) {
  return <ModalButton label="Edit" icon={<Pencil />} className="btn sm" title="Edit client" render={(close) => <ClientForm initial={initial} onDone={close} />} />;
}

export function NewAccountButton({ clients, pricing, defaultClient, className }: { clients: ClientOpt[]; pricing: Record<number, Pricing>; defaultClient?: number; className?: string }) {
  return (
    <ModalButton
      label="New account request"
      icon={<Megaphone />}
      className={className}
      title="New ad account request"
      size="lg"
      render={(close) => <AccountRequestForm clients={clients} pricing={pricing} defaultClient={defaultClient} onDone={close} />}
    />
  );
}

export function NewTopupButton(props: {
  clients: ClientOpt[];
  accounts: { id: number; client_id: number; name: string; platform: string; origin: string | null; ad_account_id: string | null }[];
  methods: MethodOpt[];
  pricing: Record<number, Pricing>;
  fx: Record<string, number>;
  min: number;
  defaultClient?: number;
  className?: string;
}) {
  return (
    <ModalButton label="New top-up" icon={<Wallet />} className={props.className} title="New top-up" size="lg" render={(close) => <TopupForm {...props} onDone={close} />} />
  );
}

export function NewPaymentButton(props: {
  clients: ClientOpt[];
  accounts: { id: number; client_id: number; name: string; status: string; account_price: number }[];
  methods: MethodOpt[];
  fx: Record<string, number>;
  defaultClient?: number;
  className?: string;
}) {
  return (
    <ModalButton label="Record payment" icon={<CreditCard />} className={props.className} title="Record client payment" size="lg" render={(close) => <PaymentForm {...props} onDone={close} />} />
  );
}

export function NewManagerButton() {
  return <ModalButton label="Add manager" icon={<UserPlus />} title="New manager" render={(close) => <ManagerForm onDone={close} />} />;
}

export function EditManagerButton({ initial }: { initial: { id: number; name: string; email: string; phone: string | null } }) {
  return <ModalButton label="Edit" icon={<Pencil />} className="btn sm" title="Edit manager" render={(close) => <ManagerForm initial={initial} onDone={close} />} />;
}

export function ResetPasswordButton({ id }: { id: number }) {
  return <ModalButton label="Reset password" icon={<KeyRound />} className="btn sm" title="Reset password" render={(close) => <ResetPasswordForm id={id} onDone={close} />} />;
}

export function ReassignClientButton({ clientId, managers, current }: { clientId: number; managers: M[]; current: number | null }) {
  return (
    <ModalButton
      label="Reassign"
      icon={<ArrowLeftRight />}
      className="btn sm"
      title="Reassign client to another manager"
      render={(close) => (
        <ReassignForm url={`/api/clients/${clientId}`} body={(to) => ({ action: "reassign", manager_id: to })} managers={managers} current={current} onDone={close} />
      )}
    />
  );
}

export function ReassignAllButton({ managerId, managers }: { managerId: number; managers: M[] }) {
  return (
    <ModalButton
      label="Reassign all clients"
      icon={<ArrowLeftRight />}
      className="btn sm"
      title="Move every client to another manager"
      render={(close) => <ReassignForm url={`/api/managers/${managerId}`} body={(to) => ({ action: "reassign_all", to })} managers={managers} current={managerId} onDone={close} />}
    />
  );
}

export function MethodButton({ initial }: { initial?: MethodOpt & { enabled: number } }) {
  return (
    <ModalButton
      label={initial ? "Edit" : "Add method"}
      icon={initial ? <Pencil /> : <Landmark />}
      className={initial ? "btn xs" : "btn primary"}
      title={initial ? `Edit ${initial.name}` : "New receiving method"}
      render={(close) => <MethodForm initial={initial} onDone={close} />}
    />
  );
}

export function NewExpenseButton({ managers, today }: { managers: M[]; today: string }) {
  return <ModalButton label="Add expense" icon={<Receipt />} title="New expense" render={(close) => <ExpenseForm managers={managers} today={today} onDone={close} />} />;
}
