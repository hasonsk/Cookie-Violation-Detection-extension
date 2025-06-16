import { ViolationSeverity, ViolationType, violationSeverityMap } from './violation-definitions.js';

const violationMessages = {
  // Thông báo chính
  mainWarning: {
    noCookiePolicy: "Trang này không có chính sách cookie",
    hasViolations: "Phát hiện {count} vi phạm liên quan đến cookie",
    complianceScore: "Điểm tuân thủ: {score}/100"
  },

  // Phân loại vi phạm
  severityLabels: {
    [ViolationSeverity.CRITICAL]: "cực kỳ nghiêm trọng",
    [ViolationSeverity.MODERATE]: "trung bình",
    [ViolationSeverity.MINOR]: "nhẹ"
  },

  // Chi tiết từng loại vi phạm
  violationDetails: {
    [ViolationType.NO_COOKIE_POLICY]: {
      title: "Không có chính sách cookie",
      description: "Website không cung cấp chính sách cookie rõ ràng",
      recommendation: "Tạo và hiển thị chính sách cookie chi tiết"
    },
    [ViolationType.MISSING_CONSENT]: {
      title: "Thiếu đồng ý của người dùng",
      description: "Cookies được đặt mà không có sự đồng ý của người dùng",
      recommendation: "Implement cookie consent banner"
    },
    [ViolationType.SENSITIVE_DATA_COLLECTION]: {
      title: "Thu thập dữ liệu nhạy cảm",
      description: "Phát hiện thu thập dữ liệu cá nhân nhạy cảm qua cookies",
      recommendation: "Xem xét lại việc thu thập dữ liệu và đảm bảo tuân thủ GDPR"
    },
    [ViolationType.INCOMPLETE_POLICY]: {
      title: "Chính sách không đầy đủ",
      description: "Chính sách cookie thiếu thông tin quan trọng",
      recommendation: "Bổ sung thông tin về mục đích sử dụng và thời gian lưu trữ"
    },
    [ViolationType.EXCESSIVE_COOKIES]: {
      title: "Quá nhiều cookies",
      description: "Website sử dụng số lượng cookies vượt mức khuyến nghị",
      recommendation: "Tối ưu hóa và giảm số lượng cookies không cần thiết"
    },
    [ViolationType.THIRD_PARTY_TRACKING]: {
      title: "Tracking bên thứ ba",
      description: "Phát hiện cookies tracking từ các bên thứ ba",
      recommendation: "Thông báo rõ ràng về việc chia sẻ dữ liệu với bên thứ ba"
    },
    [ViolationType.UNCLEAR_INFORMATION]: {
      title: "Thông tin không rõ ràng",
      description: "Chính sách cookie khó hiểu hoặc mơ hồ",
      recommendation: "Viết lại chính sách bằng ngôn ngữ dễ hiểu"
    },
    [ViolationType.MISSING_DETAILS]: {
      title: "Thiếu chi tiết",
      description: "Chính sách thiếu thông tin chi tiết về từng loại cookie",
      recommendation: "Bổ sung bảng mô tả chi tiết cho từng cookie"
    }
  },

  // Template cho dialog
  dialogTemplate: {
    title: "🚨 Cảnh báo bảo mật Cookie",
    subtitle: "Phát hiện các vấn đề về quyền riêng tư",
    buttons: {
      viewDetails: "Xem chi tiết",
      dismiss: "Bỏ qua",
      settings: "Cài đặt",
      continue: "Tiếp tục"
    }
  }
};

// Utility function để generate message
function generateWarningMessage(analysisData) {
  const { total_issues, compliance_score, issues, policy_url } = analysisData;

  let message = "";

  // Kiểm tra không có policy
  if (!policy_url) {
    message += violationMessages.mainWarning.noCookiePolicy;
  }

  // Thêm thông tin về vi phạm
  if (total_issues > 0) {
    if (message) message += ", và ";
    message += violationMessages.mainWarning.hasViolations.replace('{count}', total_issues);

    // Phân loại vi phạm theo mức độ
    const severityCounts = categorizeBySeverity(issues);
    const severityParts = [];

    Object.entries(severityCounts).forEach(([severity, count]) => {
      if (count > 0) {
        severityParts.push(`${count} ${violationMessages.severityLabels[severity]}`);
      }
    });

    if (severityParts.length > 0) {
      message += `, bao gồm ${severityParts.join(', ')}`;
    }
  }

  return message;
}

// Helper function phân loại vi phạm
function categorizeBySeverity(issues) {
  const counts = {
    [ViolationSeverity.CRITICAL]: 0,
    [ViolationSeverity.MODERATE]: 0,
    [ViolationSeverity.MINOR]: 0
  };

  issues.forEach(issue => {
    const severity = violationSeverityMap[issue.type] || ViolationSeverity.MINOR;
    counts[severity]++;
  });

  return counts;
}

export { violationMessages, generateWarningMessage, categorizeBySeverity };
