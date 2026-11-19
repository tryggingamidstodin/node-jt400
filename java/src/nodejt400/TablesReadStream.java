package nodejt400;

import java.sql.Connection;
import java.sql.ResultSet;

import org.json.simple.JSONObject;

public class TablesReadStream {
	private final ConnectionProvider connectionProvider;

	private final Connection c;

	private boolean closed = false;

	private final ResultSet rs;

	private boolean next;

	private final int bufferSize = 100;

	private char sep = '[';

	public TablesReadStream(ConnectionProvider connectionProvider, Connection c, String catalog, String schema,
			String tableNamePattern) throws Exception {
		this.connectionProvider = connectionProvider;
		this.c = c;
		ResultSet resultSet = null;
		try {
			resultSet = c.getMetaData().getTables(catalog, schema, tableNamePattern, null);
			this.rs = resultSet;
			this.next = rs.next();
		} catch (Exception e) {
			if (resultSet != null) {
				try {
					resultSet.close();
				} catch (Exception ignored) {
				}
			}
			throw e;
		}
	}

	public synchronized String read() throws Exception {
		if (next) {
			try {
				StringBuffer sb = new StringBuffer();
				int i = 0;
				while (next && i < bufferSize) {
					JSONObject table = new JSONObject();
					String tableName = rs.getString(3);
					table.put("table", tableName);
					table.put("remarks", rs.getString(5) == null ? "" : rs.getString(5));
					table.put("schema", rs.getString(2));
					sb.append(sep);
					sb.append(table.toJSONString());
					sep = ',';
					next = rs.next();
					i++;
				}
				if (!next) {
					sb.append(']');
				}
				return sb.toString();
			} catch (Exception ex) {
				close();
				throw ex;
			}
		}
		close();
		return null;
	}

	public String getMetaData() throws Exception {
		return null;
	}

	public synchronized void close() throws Exception {
		if (closed) {
			return;
		}
		closed = true;
		next = false;
		try {
			rs.close();
		} finally {
			connectionProvider.returnConnection(c);
		}
	}

}
