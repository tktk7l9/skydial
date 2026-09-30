// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { openHouseEditor } from "./houseEditor";
import { createTestCtx } from "../../test-utils/testCtx";
import { clampHouse, defaultHouse } from "../../sunsim/house";
import type { HouseModel } from "../../sunsim/house";
import { dismissToast } from "../../ui/toast";

function open(house: HouseModel | null = clampHouse(defaultHouse())) {
  const ctx = createTestCtx({ house });
  openHouseEditor(ctx);
  const sheet = screen.queryByRole("dialog");
  return { ctx, sheet: sheet === null ? null : within(sheet) };
}

const field = (name: string, scope = screen as Pick<typeof screen, "getByRole">) =>
  scope.getByRole("spinbutton", { name: new RegExp(`^${name}`) }) as HTMLInputElement;
const windowCards = (): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>(".item-card")].filter((c) =>
    within(c).queryByRole("button", { name: /^窓\d+を削除$/ }),
  );
const house = (ctx: ReturnType<typeof createTestCtx>): HouseModel => ctx.store.get().house!;

/** Let a pending post-commit rebuild settle, as it does between real edits. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

async function commit(input: HTMLInputElement, value: string): Promise<void> {
  await userEvent.clear(input);
  if (value !== "") await userEvent.type(input, value);
  input.dispatchEvent(new Event("change"));
}

describe("house editor", () => {
  afterEach(() => {
    dismissToast();
    document.body.replaceChildren();
  });

  it("does nothing while the house is off", () => {
    const { sheet } = open(null);
    expect(sheet).toBeNull();
  });

  it("names the unit of every numeric field (SHIG 28, 31, 12)", () => {
    open();
    for (const name of ["間口 (m)", "奥行 (m)", "軒高 (m)", "軒の出 (m)", "正面の方位 (°)", "地面反射率 (0–1)"]) {
      expect(screen.getAllByRole("spinbutton", { name })[0]).toBeVisible();
    }
    expect(screen.getAllByRole("spinbutton", { name: "腰高 (m)" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("spinbutton", { name: "回転 (°)" }).length).toBeGreaterThan(0);
  });

  it("applies an in-range value as typed", async () => {
    const { ctx, sheet } = open();
    expect(sheet!.getByRole("heading", { name: "家の設定" })).toBeVisible();
    await commit(field("間口"), "12");
    expect(house(ctx).width).toBe(12);
    expect(field("間口")).toHaveAttribute("aria-invalid", "false");
  });

  it("clamps an out-of-range value and says so next to the field", async () => {
    const { ctx } = open();
    await commit(field("間口"), "50");
    expect(house(ctx).width).toBe(30);
    expect(screen.getByText("2〜30 の範囲で入力してください(30 に調整しました)")).toBeVisible();
    expect(field("間口")).toHaveValue(30);
    expect(field("間口")).toHaveAttribute("aria-invalid", "true");
    // Fixing the entry clears the note.
    await settle();
    await commit(field("間口"), "20");
    await waitFor(() =>
      expect(screen.queryByText(/の範囲で入力してください/)).not.toBeInTheDocument(),
    );
  });

  it("treats an emptied field as missing, not zero", async () => {
    const { ctx } = open();
    const depth = screen.getAllByRole("spinbutton", { name: /^奥行/ })[0] as HTMLInputElement;
    await commit(depth, "");
    expect(house(ctx).depth).toBe(9);
    expect(screen.getByText(/2〜30 の範囲で入力してください\(9 に調整しました\)/)).toBeVisible();
  });

  it("rounds an angle and relabels window faces after the azimuth changes", async () => {
    const { ctx } = open();
    const faceSelect = within(windowCards()[0]).getByRole("combobox", { name: "面" });
    expect(faceSelect).toHaveDisplayValue("南");
    await commit(field("正面の方位"), "90.4");
    expect(house(ctx).azimuthDeg).toBe(90);
    expect(screen.getByText("90 に丸めました")).toBeVisible();
    await waitFor(() =>
      expect(within(windowCards()[0]).getByRole("combobox", { name: "面" })).toHaveDisplayValue("東"),
    );
  });

  it("keeps keyboard focus on the next field across the rebuild", async () => {
    open();
    const user = userEvent.setup();
    await user.click(field("軒高"));
    await user.clear(field("軒高"));
    await user.type(field("軒高"), "3.2");
    await user.tab();
    await waitFor(() => expect(document.activeElement).toBe(field("軒の出")));
  });

  it("changes a window's face and size", async () => {
    const { ctx } = open();
    const card = windowCards()[3];
    await userEvent.selectOptions(within(card).getByRole("combobox", { name: "面" }), "2");
    expect(house(ctx).windows[3].face).toBe(2);
    await commit(field("幅", within(card)), "9");
    expect(house(ctx).windows[3].w).toBe(6);
    expect(within(card).getByText("0.2〜6 の範囲で入力してください(6 に調整しました)")).toBeVisible();
  });

  it("removes a window at once and brings it back with undo", async () => {
    const { ctx } = open();
    expect(windowCards()).toHaveLength(6);
    const second = house(ctx).windows[1];
    await userEvent.click(screen.getByRole("button", { name: "窓2を削除" }));
    expect(windowCards()).toHaveLength(5);
    expect(screen.getByText("窓を削除しました")).toBeVisible();
    // Focus stays in the list: the row that moved up into slot 2.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "窓2を削除" }));

    // An edit made while the notice is up survives the undo.
    await commit(field("間口"), "11");
    await userEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(house(ctx).windows).toHaveLength(6);
    expect(house(ctx).windows[1]).toEqual(second);
    expect(house(ctx).width).toBe(11);
    expect(windowCards()).toHaveLength(6);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "窓2を削除" }));
  });

  it("moves focus to the add button after the last row is removed", async () => {
    const one = { ...clampHouse(defaultHouse()), windows: [defaultHouse().windows[0]] };
    open(one);
    await userEvent.click(screen.getByRole("button", { name: "窓1を削除" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "+ 窓" }));
  });

  it("removes and restores an obstacle, and edits one", async () => {
    const { ctx } = open();
    const obstacleCard = screen.getByRole("button", { name: "障害物1を削除" }).closest(".item-card") as HTMLElement;
    await commit(field("回転", within(obstacleCard)), "370");
    expect(house(ctx).obstacles[0].rotDeg).toBe(10);
    expect(within(obstacleCard).getByText(/0〜359 の範囲で入力してください/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "障害物1を削除" }));
    expect(house(ctx).obstacles).toHaveLength(0);
    expect(screen.getByText("障害物を削除しました")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(house(ctx).obstacles).toHaveLength(1);
  });

  it("adds windows up to the limit and obstacles up to theirs", async () => {
    const { ctx } = open();
    const addWindow = screen.getByRole("button", { name: "+ 窓" });
    for (let i = 0; i < 6; i++) await userEvent.click(screen.getByRole("button", { name: "+ 窓" }));
    expect(house(ctx).windows).toHaveLength(12);
    expect(screen.getByRole("button", { name: "+ 窓" })).toBeDisabled();
    expect(addWindow).not.toBeInTheDocument(); // rebuilt

    for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole("button", { name: "+ 障害物" }));
    expect(house(ctx).obstacles).toHaveLength(5);
    expect(screen.getByRole("button", { name: "+ 障害物" })).toBeDisabled();
  });

  it("switches roof shapes and their details", async () => {
    const { ctx } = open();
    expect(screen.getByRole("button", { name: "切妻" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "奥行方向" }));
    expect(house(ctx).roof).toEqual({ kind: "gable", pitchSun: 4, ridgeAxis: "d" });

    await commit(field("勾配"), "12");
    expect(house(ctx).roof).toMatchObject({ pitchSun: 10 });
    await waitFor(() => expect(screen.getByText(/0〜10 の範囲で入力してください/)).toBeVisible());

    await userEvent.click(screen.getByRole("button", { name: "片流れ" }));
    expect(house(ctx).roof).toEqual({ kind: "shed", pitchSun: 2, lowSide: 0 });
    expect(screen.getByText("低い側")).toBeVisible();
    await userEvent.click(screen.getAllByRole("button", { name: "北" }).at(-1)!);
    expect(house(ctx).roof).toEqual({ kind: "shed", pitchSun: 2, lowSide: 2 });

    await userEvent.click(screen.getByRole("button", { name: "フラット" }));
    expect(house(ctx).roof).toEqual({ kind: "flat" });
    expect(screen.queryByRole("spinbutton", { name: /^勾配/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "切妻" }));
    expect(house(ctx).roof).toEqual({ kind: "gable", pitchSun: 4, ridgeAxis: "w" });
  });

  it("resets to the default model, with undo", async () => {
    const custom = { ...clampHouse(defaultHouse()), width: 7, windows: [] };
    const { ctx } = open(custom);
    const reset = screen.getByRole("button", { name: "初期値に戻す" });
    // The reset button lives apart from the everyday controls.
    expect(reset.closest(".danger-zone")).not.toBeNull();
    await userEvent.click(reset);
    expect(house(ctx)).toEqual(clampHouse(defaultHouse()));
    expect(screen.getByText("家の設定を初期値に戻しました")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(house(ctx).width).toBe(7);
    expect(house(ctx).windows).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "初期値に戻す" }));
  });

  it("an undo after the sheet closed still restores the model", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { ctx } = open();
    screen.getByRole("button", { name: "窓1を削除" }).click();
    (document.querySelector(".sheet-backdrop") as HTMLElement).click();
    vi.advanceTimersByTime(400);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    screen.getByRole("button", { name: "元に戻す" }).click();
    expect(house(ctx).windows).toHaveLength(6);
    vi.useRealTimers();
  });

  it("an undo after the house was turned off rebuilds from the editor's model", async () => {
    const { ctx } = open();
    await userEvent.click(screen.getByRole("button", { name: "窓1を削除" }));
    ctx.store.set({ house: null });
    await userEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(house(ctx).windows).toHaveLength(6);
  });
});
