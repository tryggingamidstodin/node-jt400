package nodejt400;

import java.beans.PropertyVetoException;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.AS400JDBCConnectionPool;
import com.ibm.as400.access.AS400JDBCConnectionPoolDataSource;
import com.ibm.as400.access.AS400Message;
import com.ibm.as400.access.AS400PackedDecimal;
import com.ibm.as400.access.AS400Text;
import com.ibm.as400.access.ProgramCall;
import com.ibm.as400.access.ProgramParameter;
import com.ibm.as400.access.QSYSObjectPathName;

public class DB2
{
	private final AS400JDBCConnectionPool sqlPool;

	public DB2(JSONObject jsonConf)
	{
		Props conf = new Props(jsonConf);
		AS400JDBCConnectionPoolDataSource ds = new AS400JDBCConnectionPoolDataSource();
		ds.setServerName(conf.get("host"));
		ds.setUser(conf.get("user"));
		ds.setPassword(conf.get("password"));
		String naming = conf.get("naming", "system");
		ds.setNaming(naming);
		ds.setDateFormat(conf.get("dateFormat", "iso"));
		ds.setMetaDataSource(0);
		String value = conf.get("sort");
		if (value != null)
		{
			ds.setSort(value);
		}
		value = conf.get("sortTable");
		if (value != null)
		{
			ds.setSortTable(value);
		}
		value = conf.get("sortLanguage");
		if (value != null)
		{
			ds.setSortLanguage(value);
		}
		value = conf.get("libraries");
		if (value != null)
		{
			ds.setLibraries(value);
		}
		this.sqlPool = new AS400JDBCConnectionPool(ds);
	}

	public static final DB2 getInstance(String jsonConf)
	{
		JSONObject conf = (JSONObject) JSONValue.parse(jsonConf);
		return new DB2(conf);
	}

	public String query(String sql, String paramsJson)
			throws Exception
	{
		Connection c = sqlPool.getConnection();
		PreparedStatement st = null;
		JSONArray array = new JSONArray();
		try
		{
			st = c.prepareStatement(sql);
			setParams(paramsJson, st);
			ResultSet rs = st.executeQuery();
			ResultSetMetaData metaData = rs.getMetaData();
			while (rs.next())
			{
				JSONObject json = new JSONObject();
				int columnCount = metaData.getColumnCount();
				for (int i = 1; i <= columnCount; i++)
				{
					json.put(metaData.getColumnName(i), trim(rs.getString(i)));
				}
				array.add(json);
			}

		}
		catch (Exception e)
		{
			throw e;
		}
		finally
		{
			if (st != null)
				st.close();
			c.close();
		}
		return array.toJSONString();
	}

	public int update(String sql, String paramsJson)
			throws Exception
	{
		Connection c = sqlPool.getConnection();
		PreparedStatement st = null;
		int result = 0;
		try
		{
			st = c.prepareStatement(sql);
			setParams(paramsJson, st);
			result = st.executeUpdate();
		}
		catch (Exception e)
		{
			throw e;
		}
		finally
		{
			if (st != null)
				st.close();
			c.close();
		}
		return result;
	}

	private void setParams(String paramsJson, PreparedStatement st) throws SQLException
	{
		Object[] params = parseParams(paramsJson);
		for (int i = 0; i < params.length; i++)
		{
			Object value = params[i];
			if (value instanceof Long)
			{
				st.setLong(i + 1, (Long) value);
			}
			else if (value instanceof Double)
			{
				st.setDouble(i + 1, (Double) value);
			}
			else
			{
				st.setString(i + 1, value.toString());
			}
		}
	}

	public Pgm pgm(String programName, String paramsSchemaJsonStr)
	{
		return new Pgm(programName, paramsSchemaJsonStr);
	}

	private Object[] parseParams(String paramsJson)
	{
		JSONArray jsonArray = (JSONArray) JSONValue.parse(paramsJson);
		int n = jsonArray.size();
		Object[] params = new Object[n];
		for (int i = 0; i < n; i++)
		{
			params[i] = jsonArray.get(i);
		}
		return params;
	}

	private String trim(String value)
	{
		return value == null ? null : value.trim();
	}

	public class Pgm
	{
		private final String name;

		private final PgmParam[] paramArray;

		public Pgm(String programName, String paramsSchemaJsonStr)
		{
			this.name = programName;
			JSONArray paramsSchema = (JSONArray) JSONValue.parse(paramsSchemaJsonStr);
			int n = paramsSchema.size();
			paramArray = new PgmParam[n];
			for (int i = 0; i < n; i++)
			{
				Props paramDef = new Props((JSONObject) paramsSchema.get(i));
				if ("decimal".equals(paramDef.get("type")) || paramDef.has("decimals"))
				{
					paramArray[i] = new DecimalPgmParam(paramDef);
				}
				else
				{
					paramArray[i] = new TextPgmParam(paramDef);
				}
			}
		}

		public String run(String paramsJsonStr) throws Exception
		{
			Connection c = sqlPool.getConnection();
			JSONObject result = new JSONObject();
			try
			{
				JSONObject params = (JSONObject) JSONValue.parse(paramsJsonStr);
				for (PgmParam param : paramArray)
				{
					param.setValue(params.get(param.getName()));
				}

				AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) c;
				AS400 as400 = handle.getSystem();
				ProgramCall call = new ProgramCall(as400);

				//Run
				call.setProgram(QSYSObjectPathName.toPath("*LIBL", name, "PGM"), paramArray);
				if (!call.run())
				{
					AS400Message[] ms = call.getMessageList();
					StringBuffer error = new StringBuffer();
					error.append("Program ");
					error.append(call.getProgram());
					error.append(" did not run: ");
					for (int i = 0; i < ms.length; i++)
					{
						error.append(ms[i].toString());
						error.append("\n");
					}
					throw new Exception(error.toString());
				}

				//Get results
				for (PgmParam param : paramArray)
				{
					result.put(param.getName(), param.getValue());
				}

			}
			catch (Exception ex)
			{
				throw ex;
			}
			finally
			{
				c.close();
			}

			return result.toJSONString();

		}
	}
}

abstract class PgmParam extends ProgramParameter
{
	Props paramDef;

	public PgmParam(Props paramDef)
	{
		super(paramDef.getInt("size"));
		this.paramDef = paramDef;
	}

	public String getName()
	{
		return paramDef.get("name");
	}

	public abstract void setValue(Object value) throws PropertyVetoException;

	public abstract Object getValue();
}

class TextPgmParam extends PgmParam
{
	private final AS400Text parser;

	public TextPgmParam(Props paramDef)
	{
		super(paramDef);
		parser = new AS400Text(paramDef.getInt("size"));
	}

	@Override
	public void setValue(Object value) throws PropertyVetoException
	{
		super.setInputData(parser.toBytes(value == null ? "" : value));
	}

	@Override
	public Object getValue()
	{
		return ((String) parser.toObject(super.getOutputData())).trim();
	}
}

class DecimalPgmParam extends PgmParam
{
	private final AS400PackedDecimal parser;

	public DecimalPgmParam(Props paramDef)
	{
		super(paramDef);
		parser = new AS400PackedDecimal(paramDef.getInt("size"), paramDef.getInt("decimals"));
	}

	@Override
	public void setValue(Object value) throws PropertyVetoException
	{
		super.setInputData(parser.toBytes(new BigDecimal(value == null ? "0" : value.toString())));
	}

	@Override
	public Object getValue()
	{
		return parser.toObject(super.getOutputData());
	}
}

class Props
{
	private final JSONObject w;

	public Props(JSONObject w)
	{
		this.w = w;
	}

	public boolean has(String key)
	{
		return w.get(key) != null;
	}

	public String get(String key)
	{
		return (String) w.get(key);
	}

	public int getInt(String key)
	{
		return ((Number) w.get(key)).intValue();
	}

	public String get(String key, String defaultValue)
	{
		String value = (String) w.get(key);
		return value == null ? defaultValue : value;
	}
}