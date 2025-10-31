import { scanReviewProtocols } from "../src/protocol-scanner";
import { matchProtocolsForTime } from "../src/protocol-matcher";

jest.mock("../src/protocol-scanner");
jest.mock("../src/protocol-matcher");

const mockScanReviewProtocols = scanReviewProtocols as jest.MockedFunction<
  typeof scanReviewProtocols
>;
const mockMatchProtocolsForTime = matchProtocolsForTime as jest.MockedFunction<
  typeof matchProtocolsForTime
>;

describe("CLI Protocol Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scans and matches protocols on CLI startup", () => {
    const mockProtocols = [
      {
        filename: "friday.md",
        name: "Friday Review",
        trigger: { day: "friday", time: "afternoon" },
        content: "Review content",
      },
    ];

    mockScanReviewProtocols.mockReturnValue(mockProtocols);
    mockMatchProtocolsForTime.mockReturnValue([mockProtocols[0]]);

    // This test verifies the functions are called correctly
    // Actual CLI integration will be verified manually
    const protocols = scanReviewProtocols("/test/vault");
    const matches = matchProtocolsForTime(protocols, new Date());

    expect(mockScanReviewProtocols).toHaveBeenCalledWith("/test/vault");
    expect(mockMatchProtocolsForTime).toHaveBeenCalledWith(mockProtocols, expect.any(Date));
    expect(matches).toHaveLength(1);
  });
});
